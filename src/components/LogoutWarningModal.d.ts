interface LogoutWarningModalProps {
    onStay: () => void;
    onLogout: () => void;
    secondsLeft: number;
}
export default function LogoutWarningModal({ onStay, onLogout, secondsLeft }: LogoutWarningModalProps): import("react/jsx-runtime").JSX.Element;
export {};
