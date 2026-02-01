// Utility formatters for FlickX

export const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString();
};
// Add more formatters as needed
