import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{id:text('id').primaryKey(),name:text('name').notNull(),role:text('role').notNull(),active:integer('active').notNull().default(1)});
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),userId:text('user_id').notNull(),expires:integer('expires').notNull()});
export const lots=sqliteTable('lots',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),area:text('area').notNull(),lat:text('lat').notNull(),lng:text('lng').notNull(),type:text('type').notNull(),price:integer('price').notNull(),capacity:integer('capacity').notNull(),approved:integer('approved').notNull().default(1)});
export const bookings=sqliteTable('bookings',{id:text('id').primaryKey(),userId:text('user_id').notNull(),lotId:text('lot_id').notNull(),start:integer('start').notNull(),end:integer('end').notNull(),total:integer('total').notNull(),status:text('status').notNull(),created:integer('created').notNull()});
export const favorites=sqliteTable('favorites',{id:text('id').primaryKey(),userId:text('user_id').notNull(),lotId:text('lot_id').notNull()});
