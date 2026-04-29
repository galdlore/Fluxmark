import React from 'react';
import { type Language, t } from '../utils/i18n';

interface HelpViewProps {
    onClose: () => void;
    lang: Language;
}

const HelpView: React.FC<HelpViewProps> = ({ onClose, lang }) => {
    return (
        <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-4 h-full overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)] mb-3">
                <h2 className="font-bold text-sm">{t(lang, 'help', 'title')}</h2>
                <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold">{t(lang, 'help', 'close')}</button>
            </div>

            <div className="space-y-4 text-xs text-[var(--text-secondary)]">
                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                        <span>🔒 / 🔓</span> {t(lang, 'help', 'safetyModeTitle')}
                    </h3>
                    <p>
                        {t(lang, 'help', 'safetyModeDesc')}
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                        <span>💾</span> {t(lang, 'help', 'saveSessionTitle')}
                    </h3>
                    <p>
                        {t(lang, 'help', 'saveSessionDesc')}
                    </p>
                </section>

                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1">🖱️ {t(lang, 'help', 'interactionTitle')}</h3>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>{t(lang, 'help', 'interactionLeftClick')}</li>
                        <li>{t(lang, 'help', 'interactionRightClick')}</li>
                        <li>{t(lang, 'help', 'interactionDragDrop')}</li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-bold text-[var(--text-primary)] mb-1">🔍 {t(lang, 'help', 'searchTitle')}</h3>
                    <p>
                        {t(lang, 'help', 'searchDesc')}
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
