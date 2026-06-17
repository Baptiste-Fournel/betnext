import { Module } from '@nestjs/common';
import { OutboxDispatcher } from './OutboxDispatcher';

@Module({ providers: [OutboxDispatcher] })
export class MessagingModule {}
