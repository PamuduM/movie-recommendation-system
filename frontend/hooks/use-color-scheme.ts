import { useTheme } from '@/contexts/ThemeContext';

export function useColorScheme() {
	const { darkMode } = useTheme();
	return darkMode ? 'dark' : 'light';
}
