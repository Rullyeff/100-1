import { createContext, useContext } from "react";

export const QualityContext = createContext(true);
export const useLiteQuality = () => useContext(QualityContext);