import type { WingType, PayorType, IsolationType, Gender } from '../types';

// Wing type options for forms
export const WING_TYPES: { value: WingType; label: string }[] = [
  { value: 'rehab', label: 'Rehabilitation' },
  { value: 'long_term', label: 'Long Term Care' },
  { value: 'hospice', label: 'Hospice' },
  { value: 'memory_care', label: 'Memory Care' },
];

// Payor type options for forms
export const PAYOR_TYPES: { value: PayorType; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'managed_care', label: 'Managed Care' },
  { value: 'bed_hold', label: 'Bed Hold' },
  { value: 'hospice', label: 'Hospice' },
];

// Payor labels for display
export const PAYOR_LABELS: Record<PayorType, string> = {
  private: 'Private',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  managed_care: 'Managed Care',
  bed_hold: 'Bed Hold',
  hospice: 'Hospice',
};

// Isolation type options for forms
export const ISOLATION_TYPES: { value: IsolationType; label: string }[] = [
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'contact', label: 'Contact' },
  { value: 'droplet', label: 'Droplet' },
  { value: 'airborne', label: 'Airborne' },
];

// Isolation type labels for display
export const ISOLATION_TYPE_LABELS: Record<IsolationType, string> = {
  respiratory: 'Respiratory Precaution',
  contact: 'Contact Isolation',
  droplet: 'Droplet Precaution',
  airborne: 'Airborne Precaution',
};

// Gender options for forms
export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

// Default payor rates structure for case-mix/budget settings
export interface PayorRates {
  private: number;
  medicare: number;
  medicaid: number;
  managed_care: number;
  hospice: number;
  other: number;
}

export const DEFAULT_PAYOR_RATES: PayorRates = {
  private: 0,
  medicare: 0,
  medicaid: 0,
  managed_care: 0,
  hospice: 0,
  other: 0,
};

// Validation constants
export const VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  MRN_PATTERN: /^[A-Za-z0-9-]+$/,
  MRN_MAX_LENGTH: 50,
  NOTES_MAX_LENGTH: 1000,
  ROOM_NUMBER_MAX_LENGTH: 20,
  BED_LETTER_MAX_LENGTH: 2,
} as const;
