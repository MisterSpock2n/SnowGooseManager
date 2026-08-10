export type UserName = 'Nick' | 'Rhiannon';
export type EntryType = 'hourly' | 'overnight';
export type WorkType = 'cleaning' | 'maintenance' | 'it' | 'general';
export type InventoryCategory = 'maintenance' | 'guest_room' | 'breakfast_food';
export type FrequencyType = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom_days';

export interface User {
  id: string;
  email: string;
  displayName: UserName;
  role: 'admin';
  active: boolean;
}

export interface TimeEntry {
  id: string;
  propertyId: string;
  userId: string;
  entryDate: string;
  entryType: EntryType;
  workType?: WorkType;
  hoursWorked?: number;
  rateApplied?: number;
  overnightBasePay?: number;
  roomRevenue?: number;
  overnightCommissionRate?: number;
  calculatedPay: number;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  storageLocation?: string;
  vendor?: string;
  notes?: string;
}

export interface MaintenanceTask {
  id: string;
  taskName: string;
  category?: string;
  frequencyType: FrequencyType;
  customDaysInterval?: number;
  lastCompletedDate?: string;
  nextDueDate: string;
  assignedUserId?: string;
  notes?: string;
  active: boolean;
}
