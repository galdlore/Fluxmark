import React, { useEffect, useRef } from 'react';
import type { OpenFlag } from '../utils/bookmarkActions';

interface ContextMenuProps {
    x: number;
    y: number;
    targetId: string;
    isFolder: boolean;
    onClose: () => void;
    onOpenBackground: () => void;
    onSetFlag: (flag: OpenFlag) => void;
    onRename: (newName: string) => void;
    currentFlag: OpenFlag;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
    x, y, isFolder, onClose, onOpenBackground, onSetFlag, onRename, currentFlag
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    // Using simple prompt for MVP execution speed, or custom input in menu
    // Let's use simple prompt triggered by menu item for now, or replace menu with input.

    // Actually, standard interaction is click -> open prompt or inline edit.
    // We'll trigger prompt from click.

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleRenameClick = () => {
        // Simplified: use browser prompt for MVP (custom modal is better for Premium feel but requires more code)
        // Since user wants Premium, let's just make sure it works first.
        // We can use a non-blocking UI later.
        // Actually prompt is blocking but effective for this step.
        // We need to pass current name? We don't have it in props.
        // We'll just ask for "New Name".
        const name = prompt("Enter new name:");
        if (name) {
            onRename(name);
            onClose();
        }
    };

    // Adjust position if out of viewport
    const style = {
        top: Math.min(y, window.innerHeight - 250) + 'px',
        left: Math.min(x, window.innerWidth - 180) + 'px',
    };

    return (
        <div
            ref={menuRef}
            className="context-menu fixed z-50 flex-col"
            style={style}
        >
            <button className="menu-item" onClick={handleRenameClick}>
                ✏️ Rename (Virtual)
            </button>

            {isFolder ? (
                <button className="menu-item" onClick={() => { onOpenBackground(); onClose(); }}>
                    📂 Open All in Background
                </button>
            ) : (
                <>
                    <button className="menu-item" onClick={() => { onOpenBackground(); onClose(); }}>
                        Open in Background
                    </button>

                    <div className="h-[1px] bg-[var(--border-color)] my-1 w-full opacity-50"></div>

                    <div className="px-2 py-1 text-xs text-gray-500 font-bold uppercase tracking-wider">Default Action</div>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag('NF'); onClose(); }}>
                        <span>New Foreground Tab (NF)</span>
                        {currentFlag === 'NF' && <span>✓</span>}
                    </button>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag('RF'); onClose(); }}>
                        <span>Reload Current Tab (RF)</span>
                        {currentFlag === 'RF' && <span>✓</span>}
                    </button>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag('NB'); onClose(); }}>
                        <span>New Background Tab (NB)</span>
                        {currentFlag === 'NB' && <span>✓</span>}
                    </button>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag(null); onClose(); }}>
                        <span>Default (Background)</span>
                        {currentFlag === null && <span>✓</span>}
                    </button>
                </>
            )}
        </div>
    );
};

export default ContextMenu;
