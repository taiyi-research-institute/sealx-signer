const getExtensionVersion = () => {
    try {
        return chrome.runtime.getManifest().version;
    } catch {
        return '';
    }
};

export const VersionFooter = ({ className = '' }: { className?: string }) => {
    const version = getExtensionVersion();
    if (!version) return null;

    return (
        <div className={`text-[#000]/36 text-[0.875rem] leading-[1.5] ${className}`}>
            Version {version}
        </div>
    );
};
