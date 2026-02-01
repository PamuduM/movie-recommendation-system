// Utility validators for FlickX

export const isEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
export const isPasswordStrong = (password: string) => password.length >= 8;
// Add more validators as needed
