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
    jobs: "My Jobs",
    trackAcceptedCustomer: "Track accepted work and confirm completion",
    manageAcceptedWork: "Manage accepted work",
    jobRequests: "Service Requests",
    noJobs: "No jobs yet",
    noJobsDescription: "Your jobs and requests will appear here.",
    trackJob: "Track Job",
    viewJobDetails: "View Job Details",
    confirmCompleted: "Confirm work completed",
    rateProfessional: "Rate Professional",
    cancelJob: "Cancel Job",
    back: "Back",
    complaints: "Complaints & Reports",
    noComplaints: "No complaints",
    complaintHistory: "Your complaint history will appear here.",
    submitted: "Submitted",
    underReview: "Under review",
    resolved: "Resolved",
    notifications: "Notifications",
    all: "All",
    unread: "Unread",
    messages: "Messages",
    jobs: "Jobs",
    loadingNotifications: "Loading notifications…",
    caughtUp: "You're all caught up",
    newUpdates: "New connection, message and job updates will appear here.",
    chats: "My Chats",
    prosYouCanMessage: "Professionals you can message",
    customersYouCanMessage: "Customers you can message",
    loadingConnections: "Loading connections…",
    noChats: "No chats yet",
    connectToChat: "Connect with a professional to start a chat.",
    customerChatNotice: "When a customer connects with you, the chat will appear here.",
    tryAgain: "Try again",
    openChat: "Open Chat",
    viewChat: "View Chat",
    chatActive: "Chat active",
    chatClosed: "Chat closed",
    chatNotStarted: "Chat not started",
    searchProfessionals: "Search professionals",
    chooseService: "Choose a service",
    filters: "Filters",
    available: "Available",
    verified: "Verified",
    distance: "Distance",
    noProfessionals: "No professionals found",
    changeLocation: "Change location",
    useCurrentLocation: "Use current location",
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
    jobs: "मेरे काम",
    jobRequests: "सेवा अनुरोध",
    noJobs: "अभी कोई काम नहीं",
    noJobsDescription: "आपके काम और अनुरोध यहाँ दिखाई देंगे।",
    trackJob: "काम ट्रैक करें",
    viewJobDetails: "काम का विवरण देखें",
    confirmCompleted: "काम पूरा होने की पुष्टि करें",
    rateProfessional: "प्रोफ़ेशनल को रेटिंग दें",
    cancelJob: "काम रद्द करें",
    back: "वापस",
    complaints: "शिकायतें और रिपोर्ट",
    noComplaints: "कोई शिकायत नहीं",
    complaintHistory: "आपकी शिकायतों का इतिहास यहाँ दिखाई देगा।",
    submitted: "जमा किया गया",
    underReview: "समीक्षाधीन",
    resolved: "समाधान हो गया",
    notifications: "सूचनाएँ",
    all: "सभी",
    unread: "अपठित",
    messages: "संदेश",
    jobs: "काम",
    trackAcceptedCustomer: "स्वीकृत काम ट्रैक करें और पूरा होने की पुष्टि करें",
    manageAcceptedWork: "स्वीकृत काम प्रबंधित करें",
    loadingNotifications: "सूचनाएँ लोड हो रही हैं…",
    caughtUp: "आप सभी अपडेट देख चुके हैं",
    newUpdates: "नए संपर्क, संदेश और काम के अपडेट यहाँ दिखाई देंगे।",
    chats: "मेरी चैट",
    prosYouCanMessage: "वे प्रोफ़ेशनल जिन्हें आप संदेश भेज सकते हैं",
    customersYouCanMessage: "वे ग्राहक जिन्हें आप संदेश भेज सकते हैं",
    loadingConnections: "संपर्क लोड हो रहे हैं…",
    noChats: "अभी कोई चैट नहीं",
    connectToChat: "चैट शुरू करने के लिए किसी प्रोफ़ेशनल से संपर्क करें।",
    customerChatNotice: "ग्राहक के संपर्क करने पर चैट यहाँ दिखाई देगी।",
    tryAgain: "फिर कोशिश करें",
    openChat: "चैट खोलें",
    viewChat: "चैट देखें",
    chatActive: "चैट सक्रिय",
    chatClosed: "चैट बंद",
    chatNotStarted: "चैट शुरू नहीं हुई",
    searchProfessionals: "प्रोफ़ेशनल खोजें",
    chooseService: "सेवा चुनें",
    filters: "फ़िल्टर",
    available: "उपलब्ध",
    verified: "सत्यापित",
    distance: "दूरी",
    noProfessionals: "कोई प्रोफ़ेशनल नहीं मिला",
    changeLocation: "स्थान बदलें",
    useCurrentLocation: "वर्तमान स्थान का उपयोग करें",
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
