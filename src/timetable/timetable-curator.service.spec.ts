import { ForbiddenException } from '@nestjs/common';
import { TimetableCuratorService } from './timetable-curator.service';
import { LOIS_AUTOFILL_PRO_MESSAGE } from './timetable-curator.constants';

describe('TimetableCuratorService access', () => {
  const subscriptions = { checkToolAccess: jest.fn() };
  const service = new TimetableCuratorService(
    {} as any,
    {} as any,
    {} as any,
    subscriptions as any,
    {} as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects Free schools with the Pro upgrade copy', async () => {
    subscriptions.checkToolAccess.mockResolvedValue({ hasAccess: false });
    await expect(service.assertAgoraAiAccess('school-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertAgoraAiAccess('school-1')).rejects.toThrow(LOIS_AUTOFILL_PRO_MESSAGE);
  });

  it('allows Pro schools with agora-ai access', async () => {
    subscriptions.checkToolAccess.mockResolvedValue({ hasAccess: true });
    await expect(service.assertAgoraAiAccess('school-1')).resolves.toBeUndefined();
  });
});
