import React, { useState } from 'react';
import { BookmarkPlus, Image as ImageIcon, Layers, Plus, X } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { HelpTooltip } from './HelpTooltip';

interface TabBarProps {
  onOpenNewImage: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onOpenNewImage }) => {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const renameTab = useEditorStore((s) => s.renameTab);
  const saveSnapshotTab = useEditorStore((s) => s.saveSnapshotTab);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setDraftTitle(currentTitle);
  };

  const commitRename = () => {
    if (editingId && draftTitle.trim()) {
      renameTab(editingId, draftTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#161618]/95 px-3 backdrop-blur-2xl select-none">
      {/* Scrollable IDE-style Tabs */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isModified = tab.past.length > 0;
          return (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              onDoubleClick={() => startRename(tab.id, tab.title)}
              title="クリックで切替 / ダブルクリックで名前変更"
              className={`group flex h-7 max-w-[210px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs transition-all ${
                isActive
                  ? 'bg-[#2c2c2e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)]'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              }`}
            >
              {tab.isSnapshot ? (
                <Layers className={`h-3 w-3 shrink-0 ${isActive ? 'text-[#0A84FF]' : 'text-zinc-500'}`} />
              ) : (
                <ImageIcon className={`h-3 w-3 shrink-0 ${isActive ? 'text-zinc-200' : 'text-zinc-500'}`} />
              )}

              {editingId === tab.id ? (
                <input
                  type="text"
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-28 rounded bg-black/50 px-1 py-0.5 text-[11px] text-white outline-none ring-1 ring-[#0A84FF]"
                />
              ) : (
                <span className="truncate font-medium">{tab.title}</span>
              )}

              {tab.savedAt && (
                <span className="shrink-0 font-mono text-[9px] text-zinc-500">{tab.savedAt}</span>
              )}

              {isModified && !tab.isSnapshot && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A84FF]" />
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="タブを閉じる"
                className="ml-0.5 rounded-full p-0.5 text-zinc-500 opacity-0 transition hover:bg-white/15 hover:text-white group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onOpenNewImage}
          title="新しい画像を別タブで開く"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right-side Snapshot ("一時保存") Action */}
      <div className="flex shrink-0 items-center gap-1.5 pl-2 border-l border-white/[0.08]">
        <button
          type="button"
          onClick={saveSnapshotTab}
          className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-medium text-zinc-100 transition hover:bg-[#0A84FF] hover:text-white active:scale-[0.98]"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <span>一時保存</span>
        </button>
        <HelpTooltip text="現在の調整状態を新しいタブへ一時保存（複製）します。異なる色味や明るさの案をタブで切り替えながら瞬時に見比べられます（Ctrl+S）。" />
      </div>
    </div>
  );
};
