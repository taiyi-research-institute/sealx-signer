import React from "react";

export interface GoogleDriveAuthMaskProps {
    /** Whether the mask is visible */
    visible?: boolean;
    /** Custom title text */
    title?: string;
    /** Custom description text */
    description?: string;
    /** Custom footer text */
    footerText?: string;
    /** Custom spinner color */
    spinnerColor?: string;
    /** Custom maximum width */
    maxWidth?: string;
    /** Additional CSS class names */
    className?: string;
}

/**
 * A reusable Google Drive authorization mask component
 * 
 * This component displays a loading overlay with a spinner and messaging
 * for Google Drive authorization processes. It can be used across multiple
 * pages where Google Drive authentication is required.
 * 
 * @param {GoogleDriveAuthMaskProps} props - Component props
 * @returns A Google Drive authorization mask component
 */
const GoogleDriveAuthMask: React.FC<GoogleDriveAuthMaskProps> = ({
    visible = true,
    title = "Connecting to Google Drive",
    description = "Please authorize access to Google Drive in the popup window...",
    footerText = "This may open a new window for Google authentication",
    spinnerColor = "#00be78",
    maxWidth = "400px",
    className = "",
}) => {
    if (!visible) {
        return null;
    }

    return (
        <div className={`absolute top-0 left-0 h-full w-full flex items-center justify-center z-50 px-[24px] bg-neutral-950/50 ${className}`}>
            <div
                className="bg-surface border border-neutral-950/[0.1] rounded-[12px] p-[24px] w-full relative"
                style={{ maxWidth }}
            >
                <div className="flex flex-col items-center">
                    {/* Google Drive icon or loading spinner */}
                    <div className="w-[60px] h-[60px] mb-[24px] flex items-center justify-center">
                        <div
                            className="w-[48px] h-[48px] rounded-full border-4 border-neutral-950/[10%]"
                            style={{
                                borderTopColor: spinnerColor,
                                animation: 'spin 1s linear infinite'
                            }}
                        ></div>
                    </div>

                    <div className="text-[24px] font-[500] mb-[16px] text-center">
                        {title}
                    </div>

                    <div className="text-[16px] font-[500] mb-[24px] text-text-secondary text-center">
                        {description}
                    </div>

                    <div className="text-[14px] text-[#000]/[40%] text-center">
                        {footerText}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoogleDriveAuthMask;
