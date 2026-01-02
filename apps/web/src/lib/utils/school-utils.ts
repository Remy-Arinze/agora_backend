// Format role input: capitalize first letter of each word
export const formatRoleInput = (value: string): string => {
  return value
    .trim()
    .split(/\s+/) // Split on any whitespace (handles multiple spaces)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .filter(word => word.length > 0) // Remove empty strings
    .join(' ');
};

// Format role to display name - roles are now stored as strings, so just return as-is
export const formatRoleDisplayName = (role: string): string => {
  // Role is already formatted by the frontend before sending to backend
  // Backend stores it as-is, so just return it
  return role || 'Administrator';
};

