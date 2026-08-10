import { EntryType, UserName, WorkType } from '../types/domain';

export function getHourlyRate(user: UserName, workType: WorkType): number {
  if (user === 'Nick') {
    if (workType === 'cleaning' || workType === 'maintenance') return 40;
    if (workType === 'it') return 75;
  }

  if (user === 'Rhiannon' && workType === 'general') return 25;

  throw new Error('Invalid user/work type combination');
}

export function calculatePay(input: {
  user: UserName;
  entryType: EntryType;
  workType?: WorkType;
  hoursWorked?: number;
  roomRevenue?: number;
}): number {
  const { user, entryType, workType, hoursWorked = 0, roomRevenue = 0 } = input;

  if (entryType === 'hourly') {
    if (!workType) throw new Error('Work type is required for hourly entries');
    return Number((hoursWorked * getHourlyRate(user, workType)).toFixed(2));
  }

  if (user !== 'Rhiannon') {
    throw new Error('Only Rhiannon can log overnight entries');
  }

  return Number((250 + roomRevenue * 0.1).toFixed(2));
}
