/**
 * Los apuntes en el Atril (`05` §2-§3), en un solo sitio para no engordar la
 * pantalla: el script que los pinta en la hoja, qué hacer con los toques
 * largos y los toques en un apunte, y las dos hojas (crear/editar y la
 * lista con las capas).
 */
import React, { useMemo, useState } from 'react';
import ApunteSheet, {
  type ApunteDraft,
} from '@/components/apuntes/ApunteSheet';
import ApuntesSheet from '@/components/apuntes/ApuntesSheet';
import ContextMenuSheet from '@/components/ContextMenuSheet';
import { useApuntes } from '@/hooks/useApuntes';
import { useLive } from '@/contexts/LiveContext';
import { anchorFor, type Apunte, type ApunteSong } from '@/services/apuntes';
import { apuntesScript, toPainted } from '@/utils/apuntesScript';
import { h } from '@/utils/haptics';

export function useSongApuntes({
  song,
  content,
  isAdmin,
  onArrangement,
}: {
  song: ApunteSong | null;
  content: string | null;
  isAdmin: boolean;
  /** Admin: insertar un arreglo oficial `{arr:}` en esa línea. */
  onArrangement: (line: number) => void;
}) {
  const live = useLive();
  const { notes, visible, hidden, setHidden, save, remove } = useApuntes(
    song,
    content,
  );
  const [draft, setDraft] = useState<ApunteDraft | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [adminLine, setAdminLine] = useState<number | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const script = useMemo(() => apuntesScript(toPainted(visible)), [visible]);

  const atLine = (line: number) => {
    // «¿Dónde iba esto?»: el siguiente toque largo lo recoloca.
    const m = moving ? notes.find((n) => n.id === moving) : null;
    if (m && content) {
      h.success();
      save({
        ...m,
        ...anchorFor(content, line),
        orphan: false,
        updatedAt: Date.now(),
      });
      setMoving(null);
      return;
    }
    h.select();
    setDraft({ mode: 'new', line });
  };

  /** Mensajes de la hoja que son de los apuntes (devuelve si lo eran). */
  const onMessage = (data: unknown): boolean => {
    const d = data as { type?: string; line?: unknown; id?: unknown } | null;
    if (!d || typeof d.type !== 'string') return false;
    if (d.type === 'line-longpress' && typeof d.line === 'number') {
      atLine(d.line);
      return true;
    }
    if (d.type === 'arr-longpress' && typeof d.line === 'number') {
      // Admin: ¿apunte propio o arreglo oficial para todos?
      if (moving) atLine(d.line);
      else setAdminLine(d.line);
      return true;
    }
    if (d.type === 'apunte-tap' && typeof d.id === 'string') {
      const a = notes.find((n) => n.id === d.id);
      if (a) setDraft({ mode: 'edit', apunte: a });
      return true;
    }
    return false;
  };

  const onSave = (a: Apunte, sendLive: boolean) => {
    save(a);
    if (sendLive) live.sendApunte(a);
  };

  const sheets =
    song && content ? (
      <>
        <ApunteSheet
          draft={draft}
          onClose={() => setDraft(null)}
          song={song}
          content={content}
          onSave={onSave}
          onDelete={(id) => remove(id)}
          onMove={(id) => setMoving(id)}
        />
        <ApuntesSheet
          visible={listOpen}
          onClose={() => setListOpen(false)}
          notes={notes}
          hidden={hidden}
          onHiddenChange={setHidden}
          onEdit={(a) => {
            setListOpen(false);
            setDraft({ mode: 'edit', apunte: a });
          }}
        />
        {isAdmin ? (
          <ContextMenuSheet
            visible={adminLine !== null}
            onClose={() => setAdminLine(null)}
            title="En esta línea"
            actions={[
              {
                key: 'apunte',
                label: 'Un apunte',
                icon: 'edit-note',
                onPress: () => {
                  const line = adminLine;
                  setAdminLine(null);
                  if (line !== null) setDraft({ mode: 'new', line });
                },
              },
              {
                key: 'arr',
                label: 'Un arreglo oficial (para todos)',
                icon: 'library-music',
                onPress: () => {
                  const line = adminLine;
                  setAdminLine(null);
                  if (line !== null) onArrangement(line);
                },
              },
            ]}
          />
        ) : null}
      </>
    ) : null;

  return {
    script,
    onMessage,
    sheets,
    count: notes.length,
    moving: moving !== null,
    openList: () => setListOpen(true),
  };
}
