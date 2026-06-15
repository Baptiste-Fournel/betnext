import { Module } from '@nestjs/common';
import { OutboxDispatcher } from './OutboxDispatcher';

/** Câble le relais Outbox dans le boot (BET-8). Le CONSOMMATEUR Pricing tourne en process SÉPARÉ. */
@Module({ providers: [OutboxDispatcher] })
export class MessagingModule {}
