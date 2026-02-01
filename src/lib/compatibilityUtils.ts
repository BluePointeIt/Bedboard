import type { Resident, Bed, Gender } from '../types';

// Diagnosis categories for matching
export const DIAGNOSIS_CATEGORIES: Record<string, string[]> = {
  'Dementia': ['Alzheimer\'s', 'Dementia', 'Memory Loss', 'Cognitive Decline', 'Lewy Body'],
  'Cardiac': ['CHF', 'Heart Failure', 'Cardiac', 'Congestive Heart', 'Arrhythmia', 'Atrial Fibrillation'],
  'Respiratory': ['COPD', 'Pneumonia', 'Respiratory', 'Emphysema', 'Bronchitis', 'Pulmonary'],
  'Rehabilitation': ['Hip Replacement', 'Knee Replacement', 'Stroke Recovery', 'Post-Surgical', 'Physical Therapy', 'Joint Replacement'],
  'Neurological': ['Stroke', 'Parkinson\'s', 'MS', 'Multiple Sclerosis', 'Neuropathy', 'Seizure'],
  'Oncology': ['Cancer', 'Oncology', 'Chemotherapy', 'Radiation', 'Tumor', 'Malignant'],
  'Renal': ['Kidney', 'Renal', 'Dialysis', 'CKD', 'ESRD'],
  'Diabetes': ['Diabetes', 'Diabetic', 'Hyperglycemia', 'Insulin'],
  'Infectious': ['Infection', 'Sepsis', 'MRSA', 'C. diff', 'VRE', 'Infectious'],
  'Immunocompromised': ['Immunocompromised', 'HIV', 'AIDS', 'Transplant', 'Immunodeficiency'],
};

// Diagnosis conflicts - these combinations should be flagged as potential issues
export const DIAGNOSIS_CONFLICTS: Array<{ category: string; conflictsWith: string[]; reason: string }> = [
  {
    category: 'Infectious',
    conflictsWith: ['Immunocompromised'],
    reason: 'Infectious conditions may pose risk to immunocompromised residents'
  },
  {
    category: 'Dementia',
    conflictsWith: ['Dementia'],
    reason: 'Two residents with dementia may require additional supervision'
  },
];

export interface BedCompatibilityScore {
  bedId: string;
  totalScore: number;       // 0-100 overall score
  ageScore: number;         // 0-100
  diagnosisScore: number;   // 0-100
  flexibilityScore: number; // Higher if placing here doesn't block future assignments
  roommate?: {
    id: string;
    name: string;
    age: number | null;
    diagnosis: string | null;
  };
  warnings: string[];       // Any compatibility warnings
  recommended: boolean;     // Top recommendation flag
  bedInfo: {
    roomNumber: string;
    bedLetter: string;
    wingName: string;
  };
}

export interface MoveRecommendation {
  residentId: string;
  residentName: string;
  currentBedId: string;
  currentBed: string;       // e.g., "Room 102A"
  suggestedBedId: string;
  suggestedBed: string;     // e.g., "Room 105A"
  reason: string;           // "Would free 2 male beds in Room 101"
  impact: number;           // How many beds this would free up
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string | undefined | null): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Score age compatibility (0-100)
 * 100 = same age, decreases as gap grows, 0 if >20 years apart
 */
export function scoreAgeCompatibility(age1: number | null, age2: number | null): number {
  // If either age is unknown, return neutral score
  if (age1 === null || age2 === null) return 50;

  const ageDiff = Math.abs(age1 - age2);

  // Same age or within 5 years: excellent (100-75)
  if (ageDiff <= 5) return 100 - (ageDiff * 5);

  // 6-10 years: good (70-50)
  if (ageDiff <= 10) return 75 - ((ageDiff - 5) * 5);

  // 11-20 years: moderate (45-0)
  if (ageDiff <= 20) return Math.max(0, 50 - ((ageDiff - 10) * 5));

  // >20 years: poor
  return 0;
}

/**
 * Get the category for a diagnosis
 */
export function getDiagnosisCategory(diagnosis: string | undefined | null): string | null {
  if (!diagnosis) return null;

  const lowerDiagnosis = diagnosis.toLowerCase();

  for (const [category, keywords] of Object.entries(DIAGNOSIS_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerDiagnosis.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Score diagnosis compatibility (0-100)
 * 100 = same diagnosis, 75 = same category, 50 = no diagnosis, 25 = different category, 0 = conflict
 */
export function scoreDiagnosisCompatibility(
  diag1: string | undefined | null,
  diag2: string | undefined | null
): { score: number; conflict?: string } {
  // If either diagnosis is not set, return neutral score
  if (!diag1 || !diag2) return { score: 50 };

  const lowerDiag1 = diag1.toLowerCase();
  const lowerDiag2 = diag2.toLowerCase();

  // Exact match (or very similar)
  if (lowerDiag1 === lowerDiag2) return { score: 100 };

  // Check if one contains the other
  if (lowerDiag1.includes(lowerDiag2) || lowerDiag2.includes(lowerDiag1)) {
    return { score: 90 };
  }

  // Get categories
  const cat1 = getDiagnosisCategory(diag1);
  const cat2 = getDiagnosisCategory(diag2);

  // Check for conflicts
  for (const conflict of DIAGNOSIS_CONFLICTS) {
    const isCat1Conflict = cat1 === conflict.category;
    const isCat2Conflict = cat2 === conflict.category;
    const isCat1Target = conflict.conflictsWith.includes(cat1 || '');
    const isCat2Target = conflict.conflictsWith.includes(cat2 || '');

    if ((isCat1Conflict && isCat2Target) || (isCat2Conflict && isCat1Target)) {
      return { score: 0, conflict: conflict.reason };
    }
  }

  // Same category but different specific diagnosis
  if (cat1 && cat2 && cat1 === cat2) {
    return { score: 75 };
  }

  // Different categories, no conflict
  if (cat1 && cat2) {
    return { score: 40 };
  }

  // One has category, one doesn't
  return { score: 50 };
}

interface BedWithRoommate {
  bed: Bed & { room?: { room_number: string; wing?: { name: string; id: string } } };
  roommate?: Resident;
}

interface RoomInfo {
  id: string;
  roomNumber: string;
  bedsInRoom: Array<{
    bedId: string;
    bedLetter: string;
    status: string;
    resident?: Resident;
  }>;
  gender: Gender | null;
  hasSharedBathroom: boolean;
  sharedBathroomGroupId: string | null;
}

/**
 * Calculate overall bed compatibility score for a resident
 */
export function calculateBedCompatibility(
  resident: Resident,
  bed: BedWithRoommate['bed'],
  roomInfo: RoomInfo
): BedCompatibilityScore {
  const residentAge = calculateAge(resident.date_of_birth);
  const warnings: string[] = [];

  // Find roommate(s) in the same room
  const roommates = roomInfo.bedsInRoom
    .filter(b => b.bedId !== bed.id && b.resident)
    .map(b => b.resident!);

  const primaryRoommate = roommates[0];

  let ageScore = 100;
  let diagnosisScore = 100;
  let roommateInfo: BedCompatibilityScore['roommate'] | undefined;

  if (primaryRoommate) {
    // Calculate age compatibility
    const roommateAge = calculateAge(primaryRoommate.date_of_birth);
    ageScore = scoreAgeCompatibility(residentAge, roommateAge);

    if (ageScore < 50 && residentAge !== null && roommateAge !== null) {
      warnings.push(`Age gap: ${Math.abs(residentAge - roommateAge)} years`);
    }

    // Calculate diagnosis compatibility
    const diagResult = scoreDiagnosisCompatibility(resident.diagnosis, primaryRoommate.diagnosis);
    diagnosisScore = diagResult.score;

    if (diagResult.conflict) {
      warnings.push(diagResult.conflict);
    }

    roommateInfo = {
      id: primaryRoommate.id,
      name: `${primaryRoommate.first_name} ${primaryRoommate.last_name}`,
      age: calculateAge(primaryRoommate.date_of_birth),
      diagnosis: primaryRoommate.diagnosis || null,
    };
  }

  // Calculate flexibility score
  // Empty rooms are most flexible (100)
  // Rooms with same gender as resident are good (75)
  // Beds that would create a gender lock but have capacity are lower (50)
  let flexibilityScore = 100;

  const isEmptyRoom = roommates.length === 0;
  const totalBedsInRoom = roomInfo.bedsInRoom.length;
  const occupiedBeds = roomInfo.bedsInRoom.filter(b => b.resident).length;

  if (isEmptyRoom) {
    // Empty room - check if it's a single room vs multi-bed
    if (totalBedsInRoom === 1) {
      flexibilityScore = 100; // Single room, no constraints created
    } else {
      flexibilityScore = 60; // Multi-bed room, will create gender constraint
    }
  } else {
    // Has roommates
    if (roomInfo.gender === resident.gender) {
      // Same gender, good fit
      if (occupiedBeds === totalBedsInRoom - 1) {
        flexibilityScore = 80; // Last bed in room, filling it up is good
      } else {
        flexibilityScore = 70; // More beds available, neutral
      }
    } else {
      flexibilityScore = 0; // Gender mismatch - shouldn't happen due to filtering
      warnings.push('Gender mismatch with existing roommate');
    }
  }

  // Bonus for shared bathroom compatibility
  if (roomInfo.hasSharedBathroom && roomInfo.gender && roomInfo.gender !== resident.gender) {
    flexibilityScore = 0;
    if (!warnings.includes('Gender mismatch with shared bathroom')) {
      warnings.push('Gender mismatch with shared bathroom');
    }
  }

  // Calculate total weighted score
  // Weights: Age 30%, Diagnosis 40%, Flexibility 30%
  const totalScore = Math.round(
    (ageScore * 0.3) + (diagnosisScore * 0.4) + (flexibilityScore * 0.3)
  );

  return {
    bedId: bed.id,
    totalScore,
    ageScore,
    diagnosisScore,
    flexibilityScore,
    roommate: roommateInfo,
    warnings,
    recommended: false, // Will be set later when comparing all beds
    bedInfo: {
      roomNumber: bed.room?.room_number || '',
      bedLetter: bed.bed_letter,
      wingName: bed.room?.wing?.name || '',
    },
  };
}

interface RoomWithOccupancy {
  roomId: string;
  roomNumber: string;
  wingName: string;
  beds: Array<{
    bedId: string;
    bedLetter: string;
    status: string;
    resident?: Resident;
  }>;
  currentGender: Gender | null;
  hasSharedBathroom: boolean;
  sharedBathroomGroupId: string | null;
}

/**
 * Analyze occupancy patterns and suggest moves to optimize bed availability
 */
export function analyzeOccupancyOptimization(
  rooms: RoomWithOccupancy[],
  unassignedResidents: Resident[]
): MoveRecommendation[] {
  const recommendations: MoveRecommendation[] = [];

  // Find "blocked" beds - vacant beds in multi-bed rooms that are gender-constrained
  const blockedBeds: Array<{
    roomId: string;
    roomNumber: string;
    wingName: string;
    constrainedGender: Gender;
    vacantCount: number;
    occupiedResident: Resident;
    occupiedBedId: string;
  }> = [];

  for (const room of rooms) {
    if (room.beds.length <= 1) continue; // Skip single rooms

    const vacantBeds = room.beds.filter(b => b.status === 'vacant');
    const occupiedBeds = room.beds.filter(b => b.resident);

    // Room has vacant beds and is gender-constrained
    if (vacantBeds.length > 0 && occupiedBeds.length > 0 && room.currentGender) {
      for (const occupied of occupiedBeds) {
        if (occupied.resident) {
          blockedBeds.push({
            roomId: room.roomId,
            roomNumber: room.roomNumber,
            wingName: room.wingName,
            constrainedGender: room.currentGender,
            vacantCount: vacantBeds.length,
            occupiedResident: occupied.resident,
            occupiedBedId: occupied.bedId,
          });
        }
      }
    }
  }

  // Count unassigned residents by gender
  const unassignedByGender: Record<Gender, number> = {
    male: unassignedResidents.filter(r => r.gender === 'male').length,
    female: unassignedResidents.filter(r => r.gender === 'female').length,
    other: unassignedResidents.filter(r => r.gender === 'other').length,
  };

  // For each blocked scenario, check if moving the resident would help
  for (const blocked of blockedBeds) {
    const oppositeGender = blocked.constrainedGender === 'male' ? 'female' : 'male';

    // Would moving this resident help? Check if there are unassigned residents of the opposite gender
    if (unassignedByGender[oppositeGender] > 0) {
      // Find empty single rooms or rooms with the same gender as the resident being moved
      const targetRooms = rooms.filter(room => {
        const vacantBeds = room.beds.filter(b => b.status === 'vacant');
        if (vacantBeds.length === 0) return false;

        // Prefer empty rooms or rooms with same gender
        const hasOccupants = room.beds.some(b => b.resident);
        if (!hasOccupants) return true;
        if (room.currentGender === blocked.constrainedGender) return true;

        return false;
      });

      if (targetRooms.length > 0) {
        // Prefer empty rooms over occupied rooms
        targetRooms.sort((a, b) => {
          const aEmpty = !a.beds.some(b => b.resident);
          const bEmpty = !b.beds.some(b => b.resident);
          if (aEmpty && !bEmpty) return -1;
          if (!aEmpty && bEmpty) return 1;
          return 0;
        });

        const targetRoom = targetRooms[0];
        const targetBed = targetRoom.beds.find(b => b.status === 'vacant');

        if (targetBed) {
          recommendations.push({
            residentId: blocked.occupiedResident.id,
            residentName: `${blocked.occupiedResident.first_name} ${blocked.occupiedResident.last_name}`,
            currentBedId: blocked.occupiedBedId,
            currentBed: `Room ${blocked.roomNumber}`,
            suggestedBedId: targetBed.bedId,
            suggestedBed: `Room ${targetRoom.roomNumber}`,
            reason: `Would free ${blocked.vacantCount} bed${blocked.vacantCount > 1 ? 's' : ''} for ${oppositeGender} residents`,
            impact: blocked.vacantCount,
          });
        }
      }
    }
  }

  // Sort by impact (highest first)
  recommendations.sort((a, b) => b.impact - a.impact);

  // Remove duplicate recommendations for the same resident
  const seen = new Set<string>();
  const uniqueRecommendations = recommendations.filter(rec => {
    if (seen.has(rec.residentId)) return false;
    seen.add(rec.residentId);
    return true;
  });

  return uniqueRecommendations;
}

/**
 * Get compatibility label and color based on score
 */
export function getCompatibilityLabel(score: number): {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  icon: 'star' | 'check' | 'warning' | 'error';
} {
  if (score >= 80) {
    return { label: 'Excellent', color: 'green', icon: 'star' };
  } else if (score >= 60) {
    return { label: 'Good', color: 'green', icon: 'check' };
  } else if (score >= 40) {
    return { label: 'Moderate', color: 'yellow', icon: 'warning' };
  } else {
    return { label: 'Low', color: 'orange', icon: 'warning' };
  }
}
