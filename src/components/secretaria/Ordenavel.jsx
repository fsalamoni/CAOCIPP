import React from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

// Lista que se reordena arrastando (mouse, toque ou teclado), com anúncios em
// português para leitores de tela. Quem usa guarda a ordem: `onMover(de, para)`.

const INSTRUCOES = {
    draggable: 'Para mover, pressione espaço ou Enter, use as setas para cima e para baixo e pressione espaço ou Enter de novo para soltar. Esc cancela.',
};

export function ListaOrdenavel({ ids, nome, onMover, children }) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const pos = (id) => `${ids.indexOf(id) + 1} de ${ids.length}`;
    const announcements = {
        onDragStart: ({ active }) => `Pegou ${nome(active.id)}, na posição ${pos(active.id)}.`,
        onDragOver: ({ active, over }) => (over ? `${nome(active.id)} vai para a posição ${pos(over.id)}.` : `${nome(active.id)} está fora da lista.`),
        onDragEnd: ({ active, over }) => (over ? `${nome(active.id)} solta na posição ${pos(over.id)}.` : `${nome(active.id)} solta, sem mudar de lugar.`),
        onDragCancel: ({ active }) => `Movimento cancelado: ${nome(active.id)} ficou na posição ${pos(active.id)}.`,
    };
    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ announcements, screenReaderInstructions: INSTRUCOES }}
            // Marca o arrasto em andamento: o Esc cancela o arrasto em vez de fechar o diálogo em volta.
            onDragStart={() => { document.body.dataset.arrastando = '1'; }}
            onDragCancel={() => { delete document.body.dataset.arrastando; }}
            onDragEnd={({ active, over }) => {
                delete document.body.dataset.arrastando;
                if (over && active.id !== over.id) onMover(ids.indexOf(active.id), ids.indexOf(over.id));
            }}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
        </DndContext>
    );
}

/** Um item da lista. `children({ alca })`: a alça de arrastar fica onde quem usa quiser. */
export function ItemOrdenavel({ id, rotulo, className = '', children }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    const alca = (
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-roledescription="alça de arrastar" aria-label={rotulo} title="Arraste para mudar a ordem"
            className="touch-none inline-flex h-11 w-11 sm:h-8 sm:w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
            <GripVertical className="w-4 h-4" aria-hidden />
        </button>
    );
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
            className={`${className} ${isDragging ? 'relative z-10 shadow-lg ring-2 ring-indigo-300 dark:ring-indigo-700' : ''}`}>
            {children({ alca })}
        </div>
    );
}
