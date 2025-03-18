'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BrewingNote } from '@/lib/config'
import type { BrewingNoteData } from '@/app/page'
import BrewingNoteForm from './BrewingNoteForm'
import { Storage } from '@/lib/storage'

interface BrewingHistoryProps {
    isOpen: boolean
    onClose: () => void
    onOptimizingChange?: (isOptimizing: boolean) => void
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    })
}

const formatRating = (rating: number) => {
    return `[ ${rating}/5 ]`
}

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen, onOptimizingChange }) => {
    const [notes, setNotes] = useState<BrewingNote[]>([])
    const [editingNote, setEditingNote] = useState<BrewingNote | null>(null)
    const [optimizingNote, setOptimizingNote] = useState<BrewingNote | null>(null)
    const [actionMenuStates, setActionMenuStates] = useState<Record<string, boolean>>({})
    const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({})

    // 添加本地存储变化监听
    useEffect(() => {
        const loadNotes = async () => {
            try {
                const savedNotes = await Storage.get('brewingNotes')
                const parsedNotes = savedNotes ? JSON.parse(savedNotes) : []
                setNotes(parsedNotes.sort((a: BrewingNote, b: BrewingNote) => b.timestamp - a.timestamp))
            } catch (error) {
                console.error('Error loading notes:', error)
                setNotes([])
            }
        }

        // 立即加载，不管是否显示
        loadNotes()

        // 监听其他标签页的存储变化（仅在 Web 平台有效）
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes') {
                loadNotes()
            }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    const handleDelete = async (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                const updatedNotes = notes.filter(note => note.id !== noteId)
                await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
                setNotes(updatedNotes)
            } catch (error) {
                console.error('Error deleting note:', error)
                alert('删除笔记时出错，请重试')
            }
        }
    }

    const handleEdit = (note: BrewingNote) => {
        const formattedNote = {
            ...note,
            coffeeBeanInfo: {
                name: note.coffeeBeanInfo?.name || '',
                roastLevel: note.coffeeBeanInfo?.roastLevel || '中度烘焙',
                roastDate: note.coffeeBeanInfo?.roastDate || '',
            },
            rating: note.rating || 3,
            taste: {
                acidity: note.taste?.acidity || 3,
                sweetness: note.taste?.sweetness || 3,
                bitterness: note.taste?.bitterness || 3,
                body: note.taste?.body || 3,
            },
            notes: note.notes || '',
            equipment: note.equipment,
            method: note.method,
            params: note.params,
            totalTime: note.totalTime,
        }
        setEditingNote(formattedNote)
    }

    const handleOptimize = (note: BrewingNote) => {
        const formattedNote = {
            ...note,
            coffeeBeanInfo: {
                name: note.coffeeBeanInfo?.name || '',
                roastLevel: note.coffeeBeanInfo?.roastLevel || '中度烘焙',
                roastDate: note.coffeeBeanInfo?.roastDate || '',
            },
            rating: note.rating || 3,
            taste: {
                acidity: note.taste?.acidity || 3,
                sweetness: note.taste?.sweetness || 3,
                bitterness: note.taste?.bitterness || 3,
                body: note.taste?.body || 3,
            },
            notes: note.notes || '',
            equipment: note.equipment,
            method: note.method,
            params: note.params,
            totalTime: note.totalTime,
        }
        setOptimizingNote(formattedNote)
        if (onOptimizingChange) {
            onOptimizingChange(true)
        }
    }

    const handleSaveEdit = async (updatedData: BrewingNoteData) => {
        if (!editingNote) return

        const updatedNotes = notes.map(note =>
            note.id === editingNote.id
                ? {
                    ...note,
                    coffeeBeanInfo: updatedData.coffeeBeanInfo,
                    rating: updatedData.rating,
                    taste: updatedData.taste,
                    notes: updatedData.notes,
                }
                : note
        )
        await Storage.set('brewingNotes', JSON.stringify(updatedNotes))
        setNotes(updatedNotes)
        setEditingNote(null)
    }

    const copyTextToClipboard = async (text: string) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;

        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        return new Promise<void>((resolve, reject) => {
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('复制命令执行失败'));
                }
            } catch (err) {
                reject(err);
            } finally {
                document.body.removeChild(textArea);
            }
        });
    }

    const handleShare = (note: BrewingNote) => {
        try {
            const shareableNote = {
                equipment: note.equipment,
                method: note.method,
                params: note.params,
                coffeeBeanInfo: note.coffeeBeanInfo,
                rating: note.rating,
                taste: note.taste,
                notes: note.notes
            };

            const jsonString = JSON.stringify(shareableNote, null, 2);
            copyTextToClipboard(jsonString)
                .then(() => {
                    setCopySuccess(prev => ({
                        ...prev,
                        [note.id]: true
                    }));
                    setTimeout(() => {
                        setCopySuccess(prev => ({
                            ...prev,
                            [note.id]: false
                        }));
                    }, 2000);
                })
                .catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制');
                });
        } catch (err) {
            console.error('复制失败:', err);
        }
    };

    if (!isOpen) return null

    return (
        <AnimatePresence mode="wait">
            {editingNote ? (
                <motion.div
                    key="edit-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="h-full pt-safe px-safe pb-safe"
                    id="brewing-history-component"
                >
                    <BrewingNoteForm
                        id={editingNote.id}
                        isOpen={true}
                        onClose={() => setEditingNote(null)}
                        onSave={handleSaveEdit}
                        initialData={editingNote as unknown as Partial<BrewingNoteData>}
                    />
                </motion.div>
            ) : optimizingNote ? (
                <motion.div
                    key="optimize-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="h-full pt-safe px-safe pb-safe"
                    id="brewing-history-component"
                >
                    <button
                        data-action="back"
                        onClick={() => {
                            setOptimizingNote(null)
                            if (onOptimizingChange) {
                                onOptimizingChange(false)
                            }
                        }}
                        className="hidden"
                    />
                    <BrewingNoteForm
                        id={optimizingNote.id}
                        isOpen={true}
                        onClose={() => {
                            setOptimizingNote(null)
                            if (onOptimizingChange) {
                                onOptimizingChange(false)
                            }
                        }}
                        onSave={() => {
                            setOptimizingNote(null)
                            if (onOptimizingChange) {
                                onOptimizingChange(false)
                            }
                        }}
                        initialData={optimizingNote as unknown as Partial<BrewingNoteData>}
                        showOptimizationByDefault={true}
                    />
                </motion.div>
            ) : (
                <motion.div
                    key="notes-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="space-y-6"
                    id="brewing-history-component"
                >
                    {notes.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500"
                        >
                            [ 暂无冲煮记录 ]
                        </motion.div>
                    ) : (
                        <div className="space-y-6 p-6">
                            {notes.map((note, index) => (
                                <motion.div
                                    key={note.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        duration: 0.2,
                                        delay: Math.min(index * 0.05, 0.3),
                                        ease: "easeOut"
                                    }}
                                    className="group space-y-4 border-l border-neutral-200/50 pl-6 dark:border-neutral-800"
                                >
                                    <div className="flex flex-col space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-baseline justify-between">
                                                <div className="flex items-baseline space-x-2 min-w-0 overflow-hidden">
                                                    <div className="text-[10px] truncate">
                                                        {note.equipment}
                                                    </div>
                                                    {note.method && (
                                                        <>
                                                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500 shrink-0">
                                                                ·
                                                            </div>
                                                            <div className="text-[10px] font-light tracking-wide truncate">
                                                                {note.method}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-baseline ml-2 shrink-0">
                                                    <AnimatePresence mode="wait">
                                                        {actionMenuStates[note.id] ? (
                                                            <motion.div
                                                                key="action-buttons"
                                                                initial={{ opacity: 0, scale: 0.98 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                                className="flex items-baseline space-x-3"
                                                            >
                                                                <button
                                                                    onClick={() => handleEdit(note)}
                                                                    className="px-2 text-xs text-neutral-400 dark:text-neutral-500"
                                                                >
                                                                    编辑
                                                                </button>
                                                                <button
                                                                    onClick={() => handleShare(note)}
                                                                    className="px-2 text-xs text-blue-400 dark:text-blue-500 relative"
                                                                >
                                                                    {copySuccess[note.id] ? '已复制' : '分享'}
                                                                    {copySuccess[note.id] && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: 5 }}
                                                                            animate={{ opacity: 1, y: 0 }}
                                                                            exit={{ opacity: 0 }}
                                                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                                                            className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-neutral-800 dark:bg-neutral-700 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap"
                                                                        >
                                                                            已复制到剪贴板
                                                                        </motion.div>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOptimize(note)}
                                                                    className="px-2 text-xs text-emerald-600 dark:text-emerald-500 font-medium"
                                                                >
                                                                    优化
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(note.id)}
                                                                    className="px-2 text-xs text-red-400"
                                                                >
                                                                    删除
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setActionMenuStates(prev => ({
                                                                            ...prev,
                                                                            [note.id]: false
                                                                        }))
                                                                    }}
                                                                    className="w-7 h-7 flex items-center justify-center rounded-full text-sm text-neutral-400"
                                                                >
                                                                    ×
                                                                </button>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.button
                                                                key="more-button"
                                                                initial={{ opacity: 0, scale: 0.98 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                                onClick={() => {
                                                                    setActionMenuStates(prev => ({
                                                                        ...prev,
                                                                        [note.id]: true
                                                                    }))
                                                                }}
                                                                className="w-7 h-7 flex items-center justify-center text-xs text-neutral-400 dark:text-neutral-500"
                                                            >
                                                                ···
                                                            </motion.button>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                {note.coffeeBeanInfo?.name && (
                                                    <>
                                                        <span>{note.coffeeBeanInfo.name}</span>
                                                        <span>·</span>
                                                    </>
                                                )}
                                                <span>{note.coffeeBeanInfo?.roastLevel}</span>
                                                {note.coffeeBeanInfo?.roastDate && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{note.coffeeBeanInfo.roastDate}</span>
                                                    </>
                                                )}
                                                {note.params && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{note.params.coffee}</span>
                                                        <span>·</span>
                                                        <span>{note.params.water}</span>
                                                        <span>·</span>
                                                        <span>{note.params.ratio}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {Object.entries(note.taste).map(([key, value]) => (
                                                <div
                                                    key={key}
                                                    className="space-y-1"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                            {
                                                                {
                                                                    acidity: '酸度',
                                                                    sweetness: '甜度',
                                                                    bitterness: '苦度',
                                                                    body: '醇度',
                                                                }[key]
                                                            }
                                                        </div>
                                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                            [ {value} ]
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                                                    >
                                                        <div
                                                            className="h-full bg-neutral-800 dark:bg-neutral-100"
                                                            style={{ width: `${(value / 5) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-baseline justify-between">
                                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                {formatDate(note.timestamp)}
                                            </div>
                                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                {formatRating(note.rating)}
                                            </div>
                                        </div>

                                        {note.notes && (
                                            <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                {note.notes}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BrewingHistory