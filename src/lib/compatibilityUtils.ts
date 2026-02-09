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
  currentBedId?: string;    // Optional - empty for direct placements
  currentBed?: string;      // e.g., "Room 102A" - empty for direct placements
  suggestedBedId: string;
  suggestedBed: string;     // e.g., "Room 105A"
  reason: string;           // "Would free 2 male beds in Room 101"
  impact: number;           // How many beds this would free up
  isDirectPlacement?: boolean; // True if this is placing an unassigned resident directly
  compatibilityScore?: number; // 0-100 overall compatibility with potential roommates
  ageScore?: number;        // 0-100 age compatibility
  diagnosisScore?: number;  // 0-100 diagnosis compatibility
  roommate?: {              // Info about potential roommate
    name: string;
    age: number | null;
    diagnosis: string | null;
  };
  warnings?: string[];      // Compatibility warnings
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

  // Find rooms with partial occupancy (have residents AND vacant beds)
  const partiallyOccupiedRooms = rooms.filter(room => {
    if (room.beds.length <= 1) return false; // Skip single rooms
    const vacantBeds = room.beds.filter(b => b.status === 'vacant');
    const occupiedBeds = room.beds.filter(b => b.resident);
    return vacantBeds.length > 0 && occupiedBeds.length > 0;
  });

  // Count unassigned residents by gender
  const unassignedByGender: Record<Gender, number> = {
    male: unassignedResidents.filter(r => r.gender === 'male').length,
    female: unassignedResidents.filter(r => r.gender === 'female').length,
    other: unassignedResidents.filter(r => r.gender === 'other').length,
  };

  // Helper to calculate compatibility between two residents
  const calculateResidentCompatibility = (resident1: Resident, resident2: Resident) => {
    const age1 = calculateAge(resident1.date_of_birth);
    const age2 = calculateAge(resident2.date_of_birth);
    const ageScore = scoreAgeCompatibility(age1, age2);
    const diagResult = scoreDiagnosisCompatibility(resident1.diagnosis, resident2.diagnosis);
    const compatibilityScore = Math.round((ageScore * 0.4) + (diagResult.score * 0.6));

    const warnings: string[] = [];
    if (ageScore < 30) {
      warnings.push(`Large age gap (${age1 || '?'} vs ${age2 || '?'})`);
    }
    if (diagResult.conflict) {
      warnings.push(diagResult.conflict);
    }

    return { compatibilityScore, ageScore, diagnosisScore: diagResult.score, warnings, age2 };
  };

  // Look for CONSOLIDATION opportunities first - this minimizes moves
  // Find rooms where we can move one resident to another same-gender room to free up an entire room
  const consolidationMoves: MoveRecommendation[] = [];
  const roomsUsedForConsolidation = new Set<string>();

  for (const sourceRoom of partiallyOccupiedRooms) {
    if (!sourceRoom.currentGender) continue;
    if (roomsUsedForConsolidation.has(sourceRoom.roomId)) continue;

    const oppositeGender = sourceRoom.currentGender === 'male' ? 'female' : 'male';

    // Only consider consolidation if there are unassigned residents of the opposite gender who would benefit
    if (unassignedByGender[oppositeGender] === 0) continue;

    const sourceResidents = sourceRoom.beds.filter(b => b.resident).map(b => ({ bed: b, resident: b.resident! }));

    // Find another same-gender room that can accept this room's residents
    for (const targetRoom of partiallyOccupiedRooms) {
      if (targetRoom.roomId === sourceRoom.roomId) continue;
      if (targetRoom.currentGender !== sourceRoom.currentGender) continue;
      if (roomsUsedForConsolidation.has(targetRoom.roomId)) continue;

      const targetVacantBeds = targetRoom.beds.filter(b => b.status === 'vacant');
      const targetResidents = targetRoom.beds.filter(b => b.resident).map(b => b.resident!);

      // Can all source residents fit in target room?
      if (targetVacantBeds.length < sourceResidents.length) continue;

      // Check compatibility between source residents and target residents
      let allCompatible = true;
      let worstCompatibility = 100;
      let totalCompatibility = 0;
      const allWarnings: string[] = [];

      for (const source of sourceResidents) {
        for (const targetResident of targetResidents) {
          const compat = calculateResidentCompatibility(source.resident, targetResident);
          if (compat.compatibilityScore < 30 || compat.warnings.some(w => w.includes('conflict'))) {
            allCompatible = false;
            break;
          }
          worstCompatibility = Math.min(worstCompatibility, compat.compatibilityScore);
          totalCompatibility += compat.compatibilityScore;
          allWarnings.push(...compat.warnings);
        }
        if (!allCompatible) break;
      }

      if (!allCompatible) continue;

      // Good consolidation opportunity found!
      // Moving source residents to target room frees up the ENTIRE source room
      const totalBedsFreed = sourceRoom.beds.length; // All beds in source room become available

      for (let i = 0; i < sourceResidents.length; i++) {
        const source = sourceResidents[i];
        const targetBed = targetVacantBeds[i];
        const primaryTargetResident = targetResidents[0];
        const compat = calculateResidentCompatibility(source.resident, primaryTargetResident);

        consolidationMoves.push({
          residentId: source.resident.id,
          residentName: `${source.resident.first_name} ${source.resident.last_name}`,
          currentBedId: source.bed.bedId,
          currentBed: `Room ${sourceRoom.roomNumber}`,
          suggestedBedId: targetBed.bedId,
          suggestedBed: `Room ${targetRoom.roomNumber}`,
          reason: `Consolidate to free entire Room ${sourceRoom.roomNumber} (${totalBedsFreed} beds) for ${oppositeGender} residents`,
          impact: totalBedsFreed,
          compatibilityScore: compat.compatibilityScore,
          ageScore: compat.ageScore,
          diagnosisScore: compat.diagnosisScore,
          roommate: {
            name: `${primaryTargetResident.first_name} ${primaryTargetResident.last_name}`,
            age: compat.age2,
            diagnosis: primaryTargetResident.diagnosis || null,
          },
          warnings: compat.warnings.length > 0 ? compat.warnings : undefined,
        });
      }

      // Mark both rooms as used to avoid conflicting recommendations
      roomsUsedForConsolidation.add(sourceRoom.roomId);
      roomsUsedForConsolidation.add(targetRoom.roomId);
      break; // Found a consolidation for this source room
    }
  }

  // Add consolidation moves first (they're more efficient)
  recommendations.push(...consolidationMoves);

  // Find rooms where unassigned residents can be placed directly
  // Include empty rooms and same-gender rooms with vacant beds
  const getAvailableRoomsForResident = (resident: Resident) => {
    return rooms.filter(room => {
      const hasVacantBeds = room.beds.some(b => b.status === 'vacant');
      if (!hasVacantBeds) return false;

      const hasOccupants = room.beds.some(b => b.resident);
      // Empty rooms are always available
      if (!hasOccupants) return true;
      // Same-gender rooms are available
      if (room.currentGender === resident.gender) return true;

      return false;
    });
  };

  // Helper to calculate compatibility with roommates in a room
  const calculateRoomCompatibility = (resident: Resident, room: RoomWithOccupancy) => {
    const roommates = room.beds.filter(b => b.resident).map(b => b.resident!);
    if (roommates.length === 0) {
      // Empty room - perfect compatibility
      return {
        compatibilityScore: 100,
        ageScore: 100,
        diagnosisScore: 100,
        roommate: undefined,
        warnings: [] as string[],
      };
    }

    // Calculate compatibility with the first roommate (primary)
    const primaryRoommate = roommates[0];
    const residentAge = calculateAge(resident.date_of_birth);
    const roommateAge = calculateAge(primaryRoommate.date_of_birth);

    const ageScore = scoreAgeCompatibility(residentAge, roommateAge);
    const diagResult = scoreDiagnosisCompatibility(resident.diagnosis, primaryRoommate.diagnosis);
    const diagnosisScore = diagResult.score;

    // Overall score is weighted average
    const compatibilityScore = Math.round((ageScore * 0.4) + (diagnosisScore * 0.6));

    const warnings: string[] = [];
    if (ageScore < 30) {
      warnings.push(`Large age gap (${residentAge || '?'} vs ${roommateAge || '?'})`);
    }
    if (diagResult.conflict) {
      warnings.push(diagResult.conflict);
    } else if (diagnosisScore < 30) {
      warnings.push('Different diagnosis categories');
    }

    return {
      compatibilityScore,
      ageScore,
      diagnosisScore,
      roommate: {
        name: `${primaryRoommate.first_name} ${primaryRoommate.last_name}`,
        age: roommateAge,
        diagnosis: primaryRoommate.diagnosis || null,
      },
      warnings,
    };
  };

  // Track which unassigned residents already have move recommendations
  const residentsWithMoveRecs = new Set(recommendations.map(r => r.residentId));

  // For each unassigned resident without a move recommendation, suggest available room placements
  for (const resident of unassignedResidents) {
    // Skip if this resident already has a move-based recommendation
    if (residentsWithMoveRecs.has(resident.id)) continue;

    const availableRooms = getAvailableRoomsForResident(resident);

    // Create a recommendation for each available room
    for (const room of availableRooms) {
      const targetBed = room.beds.find(b => b.status === 'vacant');
      if (targetBed) {
        const compatibility = calculateRoomCompatibility(resident, room);
        const hasOccupants = room.beds.some(b => b.resident);

        let reason: string;
        if (!hasOccupants) {
          reason = 'Empty room available - no gender constraints';
        } else if (compatibility.compatibilityScore >= 70) {
          reason = `Good compatibility with roommate (${compatibility.compatibilityScore}%)`;
        } else if (compatibility.compatibilityScore >= 40) {
          reason = `Moderate compatibility with roommate (${compatibility.compatibilityScore}%)`;
        } else {
          reason = `Low compatibility with roommate (${compatibility.compatibilityScore}%)`;
        }

        recommendations.push({
          residentId: resident.id,
          residentName: `${resident.first_name} ${resident.last_name}`,
          currentBedId: undefined,
          currentBed: undefined,
          suggestedBedId: targetBed.bedId,
          suggestedBed: `Room ${room.roomNumber}`,
          reason,
          impact: room.beds.filter(b => b.status === 'vacant').length,
          isDirectPlacement: true,
          compatibilityScore: compatibility.compatibilityScore,
          ageScore: compatibility.ageScore,
          diagnosisScore: compatibility.diagnosisScore,
          roommate: compatibility.roommate,
          warnings: compatibility.warnings,
        });
      }
    }
  }

  // Sort: move recommendations first (by impact), then direct placements grouped by resident (by compatibility)
  recommendations.sort((a, b) => {
    // Moves first, then direct placements
    if (a.isDirectPlacement && !b.isDirectPlacement) return 1;
    if (!a.isDirectPlacement && b.isDirectPlacement) return -1;
    // For direct placements, group by resident name, then sort by compatibility score
    if (a.isDirectPlacement && b.isDirectPlacement) {
      if (a.residentName !== b.residentName) {
        return a.residentName.localeCompare(b.residentName);
      }
      // Same resident - sort by compatibility score (higher first)
      const aScore = a.compatibilityScore ?? 0;
      const bScore = b.compatibilityScore ?? 0;
      if (aScore !== bScore) return bScore - aScore;
    }
    // Within same type/resident, sort by impact
    return b.impact - a.impact;
  });

  // Remove duplicate recommendations for the same resident+bed combination
  // For moves: one recommendation per resident
  // For direct placements: allow multiple (one per empty room)
  const seen = new Set<string>();
  const uniqueRecommendations = recommendations.filter(rec => {
    const key = rec.isDirectPlacement
      ? `${rec.residentId}-${rec.suggestedBedId}` // Unique per resident+bed for direct placements
      : rec.residentId; // Unique per resident for moves
    if (seen.has(key)) return false;
    seen.add(key);
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
