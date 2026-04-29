import React from 'react';
import { type Language, t } from '../utils/i18n';

interface SettingsViewProps {
    lang: Language;
    onChangeLanguage: (lang: Language) => void;
    onClose: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ lang, onChangeLanguage, onClose }) => {
    return (
        <div className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] p-4 h-full overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)] mb-3">
                <h2 className="font-bold text-sm">{t(lang, 'settings', 'title')}</h2>
                <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold">
                    {t(lang, 'settings', 'close')}
                </button>
            </div>

            <div className="space-y-3 text-xs text-[var(--text-secondary)]">
                <label className="flex flex-col gap-2 max-w-[240px]">
                    <span className="font-bold text-[var(--text-primary)]">{t(lang, 'settings', 'language')}</span>
                    <select
                        value={lang}
                        onChange={(e) => onChangeLanguage(e.target.value as Language)}
                        className="text-xs bg-[var(--bg-secondary)] text-primary border border-color rounded p-1.5 outline-none"
                    >
                        <option value="ja">{t(lang, 'settings', 'japanese')}</option>
                        <option value="en">{t(lang, 'settings', 'english')}</option>
                    </select>
                </label>
            </div>
        </div>
    );
};

export default SettingsView;
