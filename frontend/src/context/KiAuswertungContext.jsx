import { createContext, useContext, useState } from "react";

const KiAuswertungContext = createContext(null);

export function KiAuswertungProvider({ children }) {
  const [activeTab, setActiveTab] = useState("prozessmodell");

  const [varianten, setVarianten] = useState(null);
  const [gesamtAnzahlVarianten, setGesamtAnzahlVarianten] = useState(null);
  const [bpmnCache, setBpmnCache] = useState({});
  const [activeIdx, setActiveIdx] = useState(null);
  const [generationCount, setGenerationCount] = useState(0);

  const [chatMessages, setChatMessages] = useState([]);

  const [bpmnFile, setBpmnFile] = useState(null);
  const [analyseVarianten, setAnalyseVarianten] = useState(null);
  const [abweichungen, setAbweichungen] = useState(null);
  const [zusammenfassung, setZusammenfassung] = useState(null);

  const value = {
    activeTab, setActiveTab,
    varianten, setVarianten,
    gesamtAnzahlVarianten, setGesamtAnzahlVarianten,
    bpmnCache, setBpmnCache,
    activeIdx, setActiveIdx,
    generationCount, setGenerationCount,
    chatMessages, setChatMessages,
    bpmnFile, setBpmnFile,
    analyseVarianten, setAnalyseVarianten,
    abweichungen, setAbweichungen,
    zusammenfassung, setZusammenfassung,
  };

  return (
    <KiAuswertungContext.Provider value={value}>
      {children}
    </KiAuswertungContext.Provider>
  );
}

export function useKiAuswertungState() {
  const ctx = useContext(KiAuswertungContext);
  if (!ctx) {
    throw new Error("useKiAuswertungState muss innerhalb von KiAuswertungProvider verwendet werden.");
  }
  return ctx;
}
