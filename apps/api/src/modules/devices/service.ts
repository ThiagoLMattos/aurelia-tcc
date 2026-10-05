import type { CreateDeviceBody, CreateDeviceResponse } from '@aurelia/shared';

import type { Clock } from '../../clock';
import { notFound, unauthenticated } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { DeviceDoc, DevicesRepo } from '../../repos/devices';
import type { EventsService } from '../events/service';
import { generateSecret, hashSecret, secretMatches } from './secret';

interface Deps {
  devices: DevicesRepo;
  events: EventsService;
  now: Clock;
}

export function createDevicesService({ devices, events, now }: Deps) {
  return {
    /** The secret is returned here and nowhere else. */
    async create(elder: ElderDoc, body: CreateDeviceBody): Promise<CreateDeviceResponse> {
      const secret = generateSecret();
      const current = now();
      const deviceId = await devices.create(elder.id, { label: body.label, secretHash: hashSecret(secret) }, current, (id) =>
        events.record(elder, { type: 'devicePaired', payload: { deviceId: id, label: body.label } }, current),
      );
      return { deviceId, secret };
    },

    async remove(elder: ElderDoc, deviceId: string): Promise<void> {
      if (!(await devices.remove(elder.id, deviceId))) throw notFound('Rastreador não encontrado.');
    },

    /** Unknown id and wrong secret are indistinguishable to the caller. */
    async authenticate(deviceId: string, secret: string): Promise<DeviceDoc> {
      const device = await devices.find(deviceId);
      if (!device || !secretMatches(secret, device.secretHash)) {
        throw unauthenticated('Credenciais do rastreador inválidas.');
      }
      return device;
    },
  };
}

export type DevicesService = ReturnType<typeof createDevicesService>;
