/*
 * Copyright © 2024 Hexastack. All rights reserved.
 *
 * Licensed under the GNU Affero General Public License v3.0 (AGPLv3) with the following additional terms:
 * 1. The name "Hexabot" is a trademark of Hexastack. You may not use this name in derivative works without express written permission.
 * 2. All derivative works must include clear attribution to the original creator and software, Hexastack and Hexabot, in a prominent location (e.g., in the software's "About" section, documentation, and README file).
 */

import EventWrapper from '@/channel/lib/EventWrapper';
import {
  AttachmentForeignKey,
  AttachmentPayload,
} from '@/chat/schemas/types/attachment';
import {
  IncomingMessageType,
  PayloadType,
  StdEventType,
  StdIncomingMessage,
} from '@/chat/schemas/types/message';
import { Payload } from '@/chat/schemas/types/quick-reply';

import WhatsappHandler from './index.channel';
import { Whatsapp } from './types';

type WhatsappEventAdapter =
  | {
      eventType: StdEventType.message | StdEventType.echo;
      messageType: IncomingMessageType.message;
      raw: Whatsapp.IncomingMessage;
    }
  | {
      eventType: StdEventType.message | StdEventType.echo;
      messageType: IncomingMessageType.attachments;
      raw: Whatsapp.IncomingMessage;
    }
  | {
      eventType: StdEventType.message;
      messageType: IncomingMessageType.postback;
      raw: Whatsapp.IncomingPostback;
    }
  | {
      eventType: StdEventType.message | StdEventType.echo;
      messageType:
        | IncomingMessageType.location
        | IncomingMessageType.attachments;
      raw: Whatsapp.IncomingMessage;
    };

export default class WhatsappEventWrapper extends EventWrapper<
  WhatsappEventAdapter,
  Whatsapp.Event
> {
  _init(event: Whatsapp.Event) {
    if (event.value.messages) {
      this._adapter.eventType = StdEventType.message;
      if (event.value.messages[0].type === Whatsapp.messageType.text) {
        this._adapter.messageType = IncomingMessageType.message;
      }
      if (event.value.messages[0].type === Whatsapp.messageType.location) {
        this._adapter.messageType = IncomingMessageType.location;
      }
      if (
        event.value.messages[0].hasOwnProperty('interactive') &&
        event.value.messages[0].interactive.hasOwnProperty('button_reply')
      ) {
        this._adapter.messageType = IncomingMessageType.postback;
      }
    }
    if (event.value.statuses) {
      //echo message
      this._adapter.eventType = StdEventType.echo;
    }
    this._adapter.raw = event;
  }

  getId(): string {
    if (this._adapter.raw.value.messages[0].id) {
      return this._adapter.raw.value.messages[0].id;
    }
    throw new Error('The message id is missing');
  }

  getPayload(): Payload | string | undefined {
    if (this._adapter.eventType === StdEventType.message) {
      switch (this._adapter.messageType) {
        case IncomingMessageType.postback:
          return this._adapter.raw.value.messages[0].interactive.button_reply
            .id;
        case IncomingMessageType.location: {
          const coordinates = this._adapter.raw.value.messages[0].location;
          return {
            type: PayloadType.location,
            coordinates: {
              lat: coordinates?.latitude || 0,
              lon: coordinates?.longitude || 0,
            },
          };
        }
      }
    }
    return undefined;
  }

  getMessage(): StdIncomingMessage {
    if (this._adapter.eventType === StdEventType.echo) {
      throw new Error('Called getMessage() on a non-message event');
    }
    switch (this._adapter.messageType) {
      case IncomingMessageType.message:
        return {
          text: this._adapter.raw.value.messages[0].text.body,
        };
      case IncomingMessageType.postback:
        return {
          postback:
            this._adapter.raw.value.messages[0].interactive.button_reply.id,
          text: this._adapter.raw.value.messages[0].interactive.button_reply
            .title,
        };
      case IncomingMessageType.location: {
        const coordinates = this._adapter.raw.value.messages[0].location;
        return {
          type: PayloadType.location,
          coordinates: {
            lat: coordinates?.latitude || 0,
            lon: coordinates?.longitude || 0,
          },
        };
      }
      default:
        throw new Error('Unknown incoming message type');
    }
  }

  getAttachments(): AttachmentPayload<AttachmentForeignKey>[] {
    return [];
  }

  /**
   * Constructor : channel's event wrapper
   *
   * @param handler - The channel's handler
   * @param event - The message event received
   */
  constructor(handler: WhatsappHandler, event: Whatsapp.Event) {
    super(handler, event);
  }

  getChannelData(): any {
    return this.get('channelData', {});
  }

  getSenderForeignId(): string {
    return this._adapter.raw.value.messages[0].from;
  }

  getRecipientForeignId(): string {
    if (this.getEventType() === StdEventType.echo) return null;
    return null;
  }

  getEventType(): StdEventType {
    return this._adapter.eventType;
  }

  getMessageType(): IncomingMessageType {
    return this._adapter.messageType || IncomingMessageType.unknown;
  }

  getDeliveredMessages(): string[] {
    return [];
  }

  getWatermark() {
    return 0;
  }
}