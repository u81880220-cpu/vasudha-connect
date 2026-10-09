import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type KamproLanguage = "en" | "hi";

const STORAGE_KEY = "kampro-language-v1";

const messages = {
  en: {
    language: "English",
    switchLanguage: "हिन्दी",
    home: "Home",
    findPro: "Find a Pro",
    chat: "Chat",
    profile: "Profile",
    findTrustedProfessionals: "Find trusted professionals",
    aroundYou: "around you.",
    searchServices: "Search for services...",
    popularServices: "Popular services",
    trustedAtDoorstep: "Verified professionals at your doorstep.",
    findProfessionals: "Find professionals",
    yourConnections: "Your connections",
    connectionsConversations: "Connections & conversations",
    openConnections: "Open your professional connections and chats",
    currentLocation: "Current location (auto-detected)",
    detectingLocation: "Detecting your location…",
    locationPermissionNeeded: "Location permission needed",
    currentLocationFallback: "Current location",
    unableDetectLocation: "Unable to detect location",
    switchToProfessional: "Switch to Professional mode",
    switchToCustomer: "Switch to Customer mode",
    switching: "Switching…",
    goodMorning: "Good morning",
    professionalAccount: "Professional account",
    growBusiness: "Grow your business.",
    getMoreCustomers: "Get more customers.",
    availableForWork: "Available for new work",
    availableNow: "Customers can see you as available",
    unavailable: "You are currently unavailable",
    incomingRequests: "Incoming job requests",
    noPendingRequests: "No pending requests right now",
    manageProfessionalProfile: "Manage professional profile",
    quickActions: "Quick actions",
    verification: "Verification",
    servicesAndArea: "Services & area",
    loading: "Loading…",
    languageSettings: "Language / भाषा",
  },
  hi: {
    language: "हिन्दी",
    switchLanguage: "EN",
    home: "होम",
    findPro: "प्रो खोजें",
    chat: "चैट",
    profile: "प्रोफ़ाइल",
    findTrustedProfessionals: "भरोसेमंद प्रोफ़ेशनल खोजें",
    aroundYou: "अपने आसपास।",
    searchServices: "सेवाएँ खोजें...",
    popularServices: "लोकप्रिय सेवाएँ",
    trustedAtDoorstep: "सत्यापित प्रोफ़ेशनल आपके दरवाज़े पर।",
    findProfessionals: "प्रोफ़ेशनल खोजें",
    yourConnections: "आपके संपर्क",
    connectionsConversations: "संपर्क और बातचीत",
    openConnections: "अपने प्रोफ़ेशनल संपर्क और चैट खोलें",
    currentLocation: "वर्तमान स्थान (अपने-आप पता किया गया)",
    detectingLocation: "आपका स्थान पता किया जा रहा है…",
    locationPermissionNeeded: "स्थान की अनुमति आवश्यक है",
    currentLocationFallback: "वर्तमान स्थान",
    unableDetectLocation: "स्थान का पता नहीं चल सका",
    switchToProfessional: "प्रोफ़ेशनल मोड पर जाएँ",
    switchToCustomer: "ग्राहक मोड पर जाएँ",
    switching: "बदल रहा है…",
    goodMorning: "सुप्रभात",
    professionalAccount: "प्रोफ़ेशनल खाता",
    growBusiness: "अपना काम बढ़ाएँ।",
    getMoreCustomers: "ज़्यादा ग्राहक पाएँ।",
    availableForWork: "नए काम के लिए उपलब्ध",
    availableNow: "ग्राहक आपको उपलब्ध देख सकते हैं",
    unavailable: "आप अभी उपलब्ध नहीं हैं",
    incomingRequests: "नए काम के अनुरोध",
    noPendingRequests: "अभी कोई अनुरोध लंबित नहीं है",
    manageProfessionalProfile: "प्रोफ़ेशनल प्रोफ़ाइल प्रबंधित करें",
    quickActions: "त्वरित विकल्प",
    verification: "सत्यापन",
    servicesAndArea: "सेवाएँ और क्षेत्र",
    loading: "लोड हो रहा है…",
    languageSettings: "भाषा / Language",
  },
} as const;

type TranslationKey = keyof typeof messages.en;
type LanguageContextValue = {
  language: KamproLanguage;
  setLanguage: (language: KamproLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<KamproLanguage>("en");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (mounted && (saved === "en" || saved === "hi")) setLanguageState(saved);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const setLanguage = useCallback(async (next: KamproLanguage) => {
    setLanguageState(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey) => messages[language][key] || messages.en[key], [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useKamproLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useKamproLanguage must be used inside LanguageProvider");
  return value;
}
