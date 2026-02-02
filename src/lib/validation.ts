import { VALIDATION } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a name field (first name, last name)
 */
export function validateName(name: string, fieldName: string = 'Name'): ValidationResult {
  const trimmed = name.trim();

  if (trimmed.length < VALIDATION.NAME_MIN_LENGTH) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (trimmed.length > VALIDATION.NAME_MAX_LENGTH) {
    return { valid: false, error: `${fieldName} must be ${VALIDATION.NAME_MAX_LENGTH} characters or less` };
  }

  // Check for potentially dangerous characters
  if (/<script|javascript:|on\w+=/i.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true };
}

/**
 * Validates a medical record number (MRN)
 */
export function validateMRN(mrn: string | undefined): ValidationResult {
  if (!mrn || mrn.trim() === '') {
    return { valid: true }; // MRN is optional
  }

  const trimmed = mrn.trim();

  if (trimmed.length > VALIDATION.MRN_MAX_LENGTH) {
    return { valid: false, error: `Medical Record Number must be ${VALIDATION.MRN_MAX_LENGTH} characters or less` };
  }

  if (!VALIDATION.MRN_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Medical Record Number can only contain letters, numbers, and hyphens' };
  }

  return { valid: true };
}

/**
 * Validates a date of birth
 * - Cannot be in the future
 * - Must be at least 1 day old (allow for newborns)
 * - Should not be more than 150 years ago
 */
export function validateDateOfBirth(dob: string | undefined): ValidationResult {
  if (!dob || dob.trim() === '') {
    return { valid: true }; // DOB is optional
  }

  const date = new Date(dob);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date > today) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 150);

  if (date < minDate) {
    return { valid: false, error: 'Date of birth is too far in the past' };
  }

  return { valid: true };
}

/**
 * Validates an admission date
 * - Cannot be more than 1 year in the future
 * - Should not be more than 100 years ago
 */
export function validateAdmissionDate(admissionDate: string): ValidationResult {
  if (!admissionDate || admissionDate.trim() === '') {
    return { valid: false, error: 'Admission date is required' };
  }

  const date = new Date(admissionDate);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  if (date > maxDate) {
    return { valid: false, error: 'Admission date cannot be more than 1 year in the future' };
  }

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  if (date < minDate) {
    return { valid: false, error: 'Admission date is too far in the past' };
  }

  return { valid: true };
}

/**
 * Validates that discharge date is after admission date
 */
export function validateDischargeDate(
  dischargeDate: string,
  admissionDate: string
): ValidationResult {
  if (!dischargeDate || dischargeDate.trim() === '') {
    return { valid: false, error: 'Discharge date is required' };
  }

  const discharge = new Date(dischargeDate);
  const admission = new Date(admissionDate);

  if (isNaN(discharge.getTime())) {
    return { valid: false, error: 'Invalid discharge date format' };
  }

  if (isNaN(admission.getTime())) {
    return { valid: false, error: 'Invalid admission date format' };
  }

  if (discharge < admission) {
    return { valid: false, error: 'Discharge date must be on or after admission date' };
  }

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  if (discharge > maxDate) {
    return { valid: false, error: 'Discharge date cannot be more than 1 year in the future' };
  }

  return { valid: true };
}

/**
 * Validates a numeric value (e.g., payor rates, counts)
 */
export function validateNonNegativeNumber(
  value: number | string,
  fieldName: string = 'Value',
  maxValue?: number
): ValidationResult {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (numValue < 0) {
    return { valid: false, error: `${fieldName} cannot be negative` };
  }

  if (maxValue !== undefined && numValue > maxValue) {
    return { valid: false, error: `${fieldName} cannot exceed ${maxValue}` };
  }

  return { valid: true };
}

/**
 * Validates notes/text field
 */
export function validateNotes(notes: string | undefined): ValidationResult {
  if (!notes || notes.trim() === '') {
    return { valid: true }; // Notes are optional
  }

  if (notes.length > VALIDATION.NOTES_MAX_LENGTH) {
    return { valid: false, error: `Notes must be ${VALIDATION.NOTES_MAX_LENGTH} characters or less` };
  }

  // Check for potentially dangerous content
  if (/<script|javascript:|on\w+=/i.test(notes)) {
    return { valid: false, error: 'Notes contain invalid content' };
  }

  return { valid: true };
}

/**
 * Validates room number
 */
export function validateRoomNumber(roomNumber: string): ValidationResult {
  const trimmed = roomNumber.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Room number is required' };
  }

  if (trimmed.length > VALIDATION.ROOM_NUMBER_MAX_LENGTH) {
    return { valid: false, error: `Room number must be ${VALIDATION.ROOM_NUMBER_MAX_LENGTH} characters or less` };
  }

  return { valid: true };
}

/**
 * Validates bed letter
 */
export function validateBedLetter(bedLetter: string): ValidationResult {
  const trimmed = bedLetter.trim().toUpperCase();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Bed letter is required' };
  }

  if (trimmed.length > VALIDATION.BED_LETTER_MAX_LENGTH) {
    return { valid: false, error: `Bed letter must be ${VALIDATION.BED_LETTER_MAX_LENGTH} characters or less` };
  }

  if (!/^[A-Z]+$/.test(trimmed)) {
    return { valid: false, error: 'Bed letter must contain only letters' };
  }

  return { valid: true };
}

/**
 * Validates a CSV file for room/bed import
 */
export function validateCSVFile(file: File): ValidationResult {
  // Check file extension
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'File must be a CSV file' };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }

  return { valid: true };
}

/**
 * Sanitizes a string for safe display/storage
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validates CSV import row data
 */
export function validateCSVRow(row: {
  room_number: string;
  wing_name: string;
  beds: string;
  shared_bathroom: string;
  bathroom_group: string;
}): ValidationResult {
  if (!row.room_number || row.room_number.trim() === '') {
    return { valid: false, error: 'Room number is required' };
  }

  if (!row.wing_name || row.wing_name.trim() === '') {
    return { valid: false, error: 'Wing name is required' };
  }

  const roomValidation = validateRoomNumber(row.room_number);
  if (!roomValidation.valid) {
    return roomValidation;
  }

  // Validate bed letters
  if (row.beds) {
    const bedLetters = row.beds.split(/[,\s]+/).map(b => b.trim().toUpperCase()).filter(b => b);
    for (const letter of bedLetters) {
      const bedValidation = validateBedLetter(letter);
      if (!bedValidation.valid) {
        return { valid: false, error: `Invalid bed letter "${letter}": ${bedValidation.error}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Comprehensive resident form validation
 */
export function validateResidentForm(data: {
  first_name: string;
  last_name: string;
  medical_record_number?: string;
  date_of_birth?: string;
  admission_date: string;
  notes?: string;
}): ValidationResult {
  // Validate first name
  const firstNameValidation = validateName(data.first_name, 'First name');
  if (!firstNameValidation.valid) return firstNameValidation;

  // Validate last name
  const lastNameValidation = validateName(data.last_name, 'Last name');
  if (!lastNameValidation.valid) return lastNameValidation;

  // Validate MRN
  const mrnValidation = validateMRN(data.medical_record_number);
  if (!mrnValidation.valid) return mrnValidation;

  // Validate DOB
  const dobValidation = validateDateOfBirth(data.date_of_birth);
  if (!dobValidation.valid) return dobValidation;

  // Validate admission date
  const admissionValidation = validateAdmissionDate(data.admission_date);
  if (!admissionValidation.valid) return admissionValidation;

  // Validate notes
  const notesValidation = validateNotes(data.notes);
  if (!notesValidation.valid) return notesValidation;

  return { valid: true };
}
