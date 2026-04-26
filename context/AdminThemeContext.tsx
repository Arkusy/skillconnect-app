import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';

type ThemeMode = 'light' | 'dark';

interface ThemeColors {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    secondary: string;
    success: string;
    danger: string;
    warning: string;
    info: string;
    iconBg: string; // For those little icon squares
    headerBg: string;
}

export const lightTheme: ThemeColors = {
    background: '#F5F7FA',
    card: '#FFFFFF',
    text: '#2f3542',
    textSecondary: '#a4b0be',
    border: '#f1f2f6',
    primary: '#2e86de',
    secondary: '#5352ed',
    success: '#2ecc71',
    danger: '#ff4757',
    warning: '#ffa502',
    info: '#70a1ff',
    iconBg: '#F5F7FA',
    headerBg: '#FFFFFF'
};

export const darkTheme: ThemeColors = {
    background: '#1e272e', // Dark slate
    card: '#2f3640', // Lighter slate
    text: '#dfe4ea', // Off white
    textSecondary: '#a4b0be', // Grey
    border: '#353b48', // Dark border
    primary: '#54a0ff', // Brighter blue for dark mode
    secondary: '#5352ed',
    success: '#2ed573',
    danger: '#ff6b81',
    warning: '#eccc68',
    info: '#1e90ff',
    iconBg: '#353b48',
    headerBg: '#2f3640'
};

interface AdminThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
    colors: ThemeColors;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined);

export const AdminThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<ThemeMode>('light');
    const [themeLoaded, setThemeLoaded] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedMode = await AsyncStorage.getItem('admin_theme_mode');
            if (savedMode === 'dark' || savedMode === 'light') {
                setMode(savedMode);
            }
        } catch (e) {
            console.log('Failed to load theme', e);
        } finally {
            setThemeLoaded(true);
        }
    };

    const toggleTheme = async () => {
        const newMode = mode === 'light' ? 'dark' : 'light';
        setMode(newMode);
        try {
            await AsyncStorage.setItem('admin_theme_mode', newMode);
        } catch (e) {
            console.log('Failed to save theme', e);
        }
    };

    const colors = mode === 'light' ? lightTheme : darkTheme;

    return (
        <AdminThemeContext.Provider value={{ mode, toggleTheme, colors }}>
            {themeLoaded && (
                <StatusBar
                    barStyle={mode === 'light' ? "dark-content" : "light-content"}
                    backgroundColor="transparent"
                    translucent={true}
                />
            )}
            {children}
        </AdminThemeContext.Provider>
    );
};

export const useAdminTheme = () => {
    const context = useContext(AdminThemeContext);
    if (!context) {
        throw new Error('useAdminTheme must be used within an AdminThemeProvider');
    }
    return context;
};
