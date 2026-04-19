import { pgTable, uuid, text, timestamp, pgEnum, date, index, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member']);
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'expired', 'revoked']);
export const reservationStatusEnum = pgEnum('reservation_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const channelFlagEnum = pgEnum('channel_flag', ['discussion', 'problem', 'maintenance', 'announcement', 'other']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ userIdx: index('sessions_user_idx').on(t.userId) }));

export const houses = pgTable('houses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  richDescription: text('rich_description'), // HTML from Tiptap
  address: text('address'),
  coverPhotoUrl: text('cover_photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const houseMembers = pgTable('house_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  houseId: uuid('house_id').references(() => houses.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: memberRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => ({
  houseIdx: index('hm_house_idx').on(t.houseId),
  userIdx: index('hm_user_idx').on(t.userId),
}));

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  houseId: uuid('house_id').references(() => houses.id, { onDelete: 'cascade' }).notNull(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  invitedUserId: uuid('invited_user_id').references(() => users.id, { onDelete: 'set null' }),
  token: text('token').notNull().unique(),
  role: memberRoleEnum('role').notNull().default('member'),
  status: invitationStatusEnum('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  houseId: uuid('house_id').references(() => houses.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  flag: channelFlagEnum('flag').notNull().default('discussion'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ houseIdx: index('channels_house_idx').on(t.houseId) }));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (t) => ({ channelIdx: index('messages_channel_idx').on(t.channelId) }));

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  houseId: uuid('house_id').references(() => houses.id, { onDelete: 'cascade' }).notNull(),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  guestCount: integer('guest_count'),
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),
  status: reservationStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ houseIdx: index('reservations_house_idx').on(t.houseId) }));

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  houseMembers: many(houseMembers),
  messages: many(messages),
  reservations: many(reservations),
}));

export const housesRelations = relations(houses, ({ many }) => ({
  members: many(houseMembers),
  channels: many(channels),
  reservations: many(reservations),
  invitations: many(invitations),
}));

export const houseMembersRelations = relations(houseMembers, ({ one }) => ({
  house: one(houses, { fields: [houseMembers.houseId], references: [houses.id] }),
  user: one(users, { fields: [houseMembers.userId], references: [users.id] }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  house: one(houses, { fields: [channels.houseId], references: [houses.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  house: one(houses, { fields: [reservations.houseId], references: [houses.id] }),
  requestedByUser: one(users, { fields: [reservations.requestedBy], references: [users.id] }),
  reviewedByUser: one(users, { fields: [reservations.reviewedBy], references: [users.id] }),
}));

