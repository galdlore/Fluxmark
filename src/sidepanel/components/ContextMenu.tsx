import React, { useEffect, useRef } from 'react';
import type { OpenFlag } from '../utils/bookmarkActions';
import { type Language, t } from '../utils/i18n';

interface ContextMenuProps {
    x: number;
    y: number;
    targetId: string;
    isFolder: boolean;
    onClose: () => void;
    onOpenBackground: (recursive: boolean) => void;
    onSetFlag: (flag: OpenFlag) => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onRestore: () => void;
    onNewFolder: () => void;
    currentFlag: OpenFlag;
    currentTitle: string;
    isSafetyMode?: boolean;
    isHidden?: boolean;
    lang: Language;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
    x, y, isFolder, onClose, onOpenBackground, onSetFlag, onRename, onDelete, onRestore, onNewFolder, currentFlag, currentTitle, isSafetyMode, isHidden, lang
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

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
        const name = prompt(t(lang, 'contextMenu', 'enterNewName'), currentTitle);
        if (name) {
            onRename(name);
            onClose();
        }
    };

    const [position, setPosition] = React.useState({ top: y, left: x });

    React.useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let newTop = y;
            let newLeft = x;

            // Check Bottom Overflow
            if (y + rect.height > viewportHeight) {
                // If it overflows bottom, position it ABOVE the cursor
                newTop = y - rect.height;
            }

            // Check Right Overflow
            if (x + rect.width > viewportWidth) {
                newLeft = viewportWidth - rect.width - 10;
            }

            setPosition({ top: Math.max(0, newTop), left: Math.max(0, newLeft) });
        }
    }, [x, y]);

    // Adjust position if out of viewport
    const style = {
        top: `${position.top}px`,
        left: `${position.left}px`,
    };

    return (
        <div
            ref={menuRef}
            className="context-menu fixed z-50 flex-col shadow-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-md overflow-hidden min-w-[180px]"
            style={style}
        >
            {!isSafetyMode && (
                <>
                    <button className="menu-item" onClick={() => { onNewFolder(); onClose(); }}>
                        {t(lang, 'contextMenu', 'newFolder')}
                    </button>
                    <button className="menu-item" onClick={handleRenameClick}>
                        {t(lang, 'contextMenu', 'rename')}
                    </button>
                </>
            )}

            {isFolder ? (
                <>
                    <button className="menu-item" onClick={() => { onOpenBackground(false); onClose(); }}>
                        {t(lang, 'contextMenu', 'openAllDirect')}
                    </button>
                    <button className="menu-item" onClick={() => { onOpenBackground(true); onClose(); }}>
                        {t(lang, 'contextMenu', 'openAllRecursive')}
                    </button>
                    <div className="h-[1px] bg-[var(--border-color)] my-1 w-full opacity-50"></div>
                    <div className="px-2 py-1 text-xs text-gray-500 font-bold uppercase tracking-wider">{t(lang, 'contextMenu', 'setChildrenOpenMode')}</div>
                    <button className="menu-item" onClick={() => { onSetFlag('NB'); onClose(); }}>
                        {t(lang, 'contextMenu', 'setModeNewTabBack')}
                    </button>
                    <button className="menu-item" onClick={() => { onSetFlag('NF'); onClose(); }}>
                        {t(lang, 'contextMenu', 'setModeNewTabFront')}
                    </button>
                    <button className="menu-item" onClick={() => { onSetFlag('RF'); onClose(); }}>
                        {t(lang, 'contextMenu', 'setModeCurrentTab')}
                    </button>
                    <button className="menu-item" onClick={() => { onSetFlag(null); onClose(); }}>
                        {t(lang, 'contextMenu', 'resetAllClear')}
                    </button>
                </>
            ) : (
                <>
                    <button className="menu-item" onClick={() => { onOpenBackground(false); onClose(); }}>
                        {t(lang, 'contextMenu', 'openInBackground')}
                    </button>
                    <div className="h-[1px] bg-[var(--border-color)] my-1 w-full opacity-50"></div>

                    <div className="px-2 py-1 text-xs text-gray-500 font-bold uppercase tracking-wider">{t(lang, 'contextMenu', 'defaultAction')}</div>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag('NF'); onClose(); }}>
                        <span>{t(lang, 'contextMenu', 'newForegroundTab')}</span>
                        {currentFlag === 'NF' && <span>✓</span>}
                    </button>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag('RF'); onClose(); }}>
                        <span>{t(lang, 'contextMenu', 'reloadCurrentTab')}</span>
                        {currentFlag === 'RF' && <span>✓</span>}
                    </button>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag('NB'); onClose(); }}>
                        <span>{t(lang, 'contextMenu', 'newBackgroundTab')}</span>
                        {currentFlag === 'NB' && <span>✓</span>}
                    </button>
                    <button className="menu-item justify-between" onClick={() => { onSetFlag(null); onClose(); }}>
                        <span>{t(lang, 'contextMenu', 'defaultBackground')}</span>
                        {currentFlag === null && <span>✓</span>}
                    </button>
                </>
            )}

            {!isSafetyMode && (
                <>
                    <div className="h-[1px] bg-[var(--border-color)] my-1 w-full opacity-50"></div>
                    {isHidden ? (
                        <button className="menu-item text-green-600 hover:bg-green-900/20" onClick={() => {
                            onRestore();
                            onClose();
                        }}>
                            {t(lang, 'contextMenu', 'restore')}
                        </button>
                    ) : (
                        <button className="menu-item text-red-500 hover:bg-red-900/20" onClick={() => {
                            onDelete();
                            onClose();
                        }}>
                            {t(lang, 'contextMenu', 'hide')}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default ContextMenu;
