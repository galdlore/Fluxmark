import React from 'react';

interface HelpViewProps {
    onClose: () => void;
}

const HelpView: React.FC<HelpViewProps> = ({ onClose }) => {
    return (
        <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-4 h-full overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)] mb-3">
                <h2 className="font-bold text-sm">Valid Usage & Features</h2>
                <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold">✕ Close</button>
            </div>

            <div className="space-y-4 text-xs text-[var(--text-secondary)]">
                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                        <span>🔒 / 🔓</span> Safety Mode
                    </h3>
                    <p>
                        Toggle between <strong>Read-Only</strong> (Safety) and <strong>Edit Mode</strong>.
                        In Safety Mode, Drag & Drop and Renaming are disabled to verify accidental changes.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                        <span>💾</span> Save Session
                    </h3>
                    <p>
                        Saves all tabs in the current window to a new folder named <strong>Session YYYY-MM-DD HH:mm</strong>.
                        The folder is created under <strong>Other Bookmarks</strong>.
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1">🖱️ Interaction</h3>
                    <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Left Click</strong>: Open bookmark (default is New Tab Background).</li>
                        <li><strong>Right Click</strong>: Open Context Menu (Rename, Delete, New Folder, Set Open Mode).</li>
                        <li><strong>Drag & Drop</strong>: Reorder bookmarks (Edit Mode only).</li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1">🔍 Search</h3>
                    <p>
                        Filter bookmarks by title or URL. Drag & Drop is disabled while searching.
                    </p>
                </section>

                <div className="pt-2 text-[10px] opacity-60 text-center border-t border-[var(--border-color)] mt-4">
                    FluxMarks v1.1.0
                </div>
            </div>
        </div>
    );
};

export default HelpView;
