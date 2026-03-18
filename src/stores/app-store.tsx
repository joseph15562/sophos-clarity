import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { ParsedFile } from "@/types/parsed-file";
import type { BrandingData } from "@/components/BrandingSetup";

export interface AppState {
  files: ParsedFile[];
  branding: BrandingData;
  viewingReports: boolean;
}

type AppAction =
  | { type: "SET_FILES"; payload: ParsedFile[] }
  | { type: "SET_BRANDING"; payload: BrandingData | ((prev: BrandingData) => BrandingData) }
  | { type: "SET_VIEWING_REPORTS"; payload: boolean };

const initialBranding: BrandingData = {
  companyName: "",
  logoUrl: null,
  customerName: "",
  environment: "",
  country: "",
  selectedFrameworks: [],
};

const initialState: AppState = {
  files: [],
  branding: initialBranding,
  viewingReports: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_FILES":
      return { ...state, files: action.payload };
    case "SET_BRANDING": {
      const next =
        typeof action.payload === "function" ? action.payload(state.branding) : action.payload;
      return { ...state, branding: next };
    }
    case "SET_VIEWING_REPORTS":
      return { ...state, viewingReports: action.payload };
    default:
      return state;
  }
}

const AppStoreContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
} | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}

export function useAppState() {
  return useAppStore().state;
}

export function useAppDispatch() {
  return useAppStore().dispatch;
}

export function useFiles() {
  const { state, dispatch } = useAppStore();
  return [
    state.files,
    useCallback((payload: ParsedFile[]) => dispatch({ type: "SET_FILES", payload }), [dispatch]),
  ] as const;
}

export function useBranding() {
  const { state, dispatch } = useAppStore();
  return [
    state.branding,
    useCallback(
    (payload: BrandingData | ((prev: BrandingData) => BrandingData)) =>
      dispatch({ type: "SET_BRANDING", payload }),
    [dispatch],
  ),
  ] as const;
}

export function useViewingReports() {
  const { state, dispatch } = useAppStore();
  return [
    state.viewingReports,
    useCallback((payload: boolean) => dispatch({ type: "SET_VIEWING_REPORTS", payload }), [dispatch]),
  ] as const;
}
