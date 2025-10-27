'use client';

/*
 * 笔记列表组件 - 存储架构说明
 *
 * 数据存储分层：
 * 1. 笔记数据 (brewingNotes): 存储在 IndexedDB 中 (通过 Storage API)
 * 2. UI 偏好设置: 存储在 localStorage 中 (视图模式、图片流设置等)
 * 3. 筛选偏好: 存储在 localStorage 中 (通过 globalCache.ts)
 *
 * 事件监听：
 * - storage: localStorage 变化 (仅 UI 偏好设置)
 * - customStorageChange: IndexedDB 变化 (笔记数据)
 * - storage:changed: 存储系统统一事件 (笔记数据)
 * - coffeeBeansUpdated: 咖啡豆数据变化
 * - brewingNotesUpdated: 笔记数据变化
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { BrewingNote } from '@/lib/core/config';
import { BrewingHistoryProps } from '../types';

import FilterTabs from './FilterTabs';
import AddNoteButton from './AddNoteButton';
import { showToast } from '@/components/common/feedback/LightToast';

import ChangeRecordEditModal from '../Form/ChangeRecordEditModal';
import { BrewingNoteData } from '@/types/app';
import {
  globalCache,
  saveSelectedEquipmentPreference,
  saveSelectedBeanPreference,
  saveSelectedDatePreference,
  saveFilterModePreference,
  saveSortOptionPreference,
  saveDateGroupingModePreference,
  calculateTotalCoffeeConsumption,
  formatConsumption,
  getSelectedEquipmentPreference,
  getSelectedBeanPreference,
  getSelectedDatePreference,
  getFilterModePreference,
  getSortOptionPreference,
  getDateGroupingModePreference,
  getSearchHistoryPreference,
  addSearchHistory,
} from './globalCache';
import ListView from './ListView';
import { SortOption, DateGroupingMode } from '../types';
import { exportSelectedNotes } from '../Share/NotesExporter';
import { useEnhancedNotesFiltering } from './hooks/useEnhancedNotesFiltering';
import { extractExtractionTime, sortNotes } from '../utils';

const BrewingHistory: React.FC<BrewingHistoryProps> = ({
  isOpen,
  onClose: _onClose,
  onAddNote,
  setAlternativeHeaderContent: _setAlternativeHeaderContent, // 不再使用，保留以兼容接口
  setShowAlternativeHeader: _setShowAlternativeHeader, // 不再使用，保留以兼容接口
  settings,
}) => {
  // 用于跟踪用户选择 - 从本地存储初始化
  const [sortOption, setSortOption] = useState<SortOption>(
    getSortOptionPreference()
  );
  const [filterMode, setFilterMode] = useState<'equipment' | 'bean' | 'date'>(
    getFilterModePreference()
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    getSelectedEquipmentPreference()
  );
  const [selectedBean, setSelectedBean] = useState<string | null>(
    getSelectedBeanPreference()
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    getSelectedDatePreference()
  );
  const [dateGroupingMode, setDateGroupingMode] = useState<DateGroupingMode>(
    getDateGroupingModePreference()
  );

  // 搜索排序状态 - 独立于普通排序，可选的
  const [searchSortOption, setSearchSortOption] = useState<SortOption | null>(
    null
  );
  const [editingChangeRecord, setEditingChangeRecord] =
    useState<BrewingNote | null>(null);

  // 模态显示状态
  const [showChangeRecordEditModal, setShowChangeRecordEditModal] =
    useState(false);

  // 分享模式状态
  const [isShareMode, setIsShareMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 搜索相关状态
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory(getSearchHistoryPreference());
  }, []);

  // 显示模式状态（持久化记忆 - 使用 localStorage 存储 UI 偏好设置）
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>(() => {
    if (typeof window !== 'undefined') {
      return (
        (localStorage.getItem('notes-view-mode') as 'list' | 'gallery') ||
        'list'
      );
    }
    return 'list';
  });

  // 图片流模式状态（持久化记忆 - 使用 localStorage 存储 UI 偏好设置）
  const [isImageFlowMode, setIsImageFlowMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('notes-is-image-flow-mode') === 'true';
    }
    return false;
  });

  // 带日期图片流模式状态（持久化记忆 - 使用 localStorage 存储 UI 偏好设置）
  const [isDateImageFlowMode, setIsDateImageFlowMode] = useState<boolean>(
    () => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('notes-is-date-image-flow-mode') === 'true';
      }
      return false;
    }
  );

  // 记住用户上次使用的图片流模式类型（持久化存储 - 使用 localStorage 存储 UI 偏好设置）
  const [lastImageFlowType, setLastImageFlowType] = useState<'normal' | 'date'>(
    () => {
      if (typeof window !== 'undefined') {
        return (
          (localStorage.getItem('notes-last-image-flow-type') as
            | 'normal'
            | 'date') || 'normal'
        );
      }
      return 'normal';
    }
  );

  // 优雅的图片流模式记忆管理
  const updateImageFlowMemory = useCallback((type: 'normal' | 'date') => {
    setLastImageFlowType(type);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notes-last-image-flow-type', type);
    }
  }, []);

  // 优雅的显示模式持久化管理
  const updateViewMode = useCallback((mode: 'list' | 'gallery') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notes-view-mode', mode);
    }
  }, []);

  const updateImageFlowState = useCallback((normal: boolean, date: boolean) => {
    setIsImageFlowMode(normal);
    setIsDateImageFlowMode(date);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notes-is-image-flow-mode', normal.toString());
      localStorage.setItem('notes-is-date-image-flow-mode', date.toString());
    }
  }, []);

  // 优雅的图片流模式状态管理
  const setImageFlowMode = useCallback(
    (normal: boolean, date: boolean, rememberChoice: boolean = true) => {
      updateImageFlowState(normal, date);

      // 如果需要记住选择，更新记忆
      if (rememberChoice && (normal || date)) {
        updateImageFlowMemory(date ? 'date' : 'normal');
      }

      // 如果开启了任何图片流模式，切换到gallery视图
      if (normal || date) {
        updateViewMode('gallery');
      }
    },
    [updateImageFlowMemory, updateViewMode, updateImageFlowState]
  );

  // 页面加载时恢复显示模式状态的一致性检查
  useEffect(() => {
    // 确保状态一致性：如果是gallery模式但两个图片流模式都是false，恢复到用户偏好
    if (viewMode === 'gallery' && !isImageFlowMode && !isDateImageFlowMode) {
      const useDate = lastImageFlowType === 'date';
      updateImageFlowState(!useDate, useDate);
    }
    // 如果是list模式但有图片流模式开启，关闭图片流模式
    else if (viewMode === 'list' && (isImageFlowMode || isDateImageFlowMode)) {
      updateImageFlowState(false, false);
    }
  }, [
    isDateImageFlowMode,
    isImageFlowMode,
    lastImageFlowType,
    updateImageFlowState,
    viewMode,
  ]); // 添加所有依赖项

  // 🔥 使用缓存初始化笔记数据,避免闪烁
  const [notes, setNotes] = useState<BrewingNote[]>(globalCache.notes || []);
  const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>(
    globalCache.equipmentNames || {}
  );
  const [customEquipments, setCustomEquipments] = useState<
    import('@/lib/core/config').CustomEquipment[]
  >([]);

  // 预览容器引用
  const notesContainerRef = useRef<HTMLDivElement>(null);

  // 🔥 使用增强的笔记筛选Hook（传入customEquipments用于兼容性比较）
  const {
    filteredNotes,
    totalCount,
    totalConsumption,
    availableEquipments,
    availableBeans,
    availableDates,
    debouncedUpdateFilters,
  } = useEnhancedNotesFiltering({
    notes: notes,
    sortOption,
    filterMode,
    selectedEquipment,
    selectedBean,
    selectedDate,
    dateGroupingMode,
    searchQuery,
    isSearching,
    preFilteredNotes: undefined, // 暂时不使用，我们需要重新组织逻辑
    customEquipments, // 🔥 传入自定义器具列表用于兼容性比较
  });

  // 搜索过滤逻辑 - 在Hook之后定义以避免循环依赖
  const searchFilteredNotes = useMemo(() => {
    if (!isSearching || !searchQuery.trim()) return filteredNotes;

    const query = searchQuery.toLowerCase().trim();
    const queryTerms = query.split(/\s+/).filter(term => term.length > 0);

    // 从原始笔记开始搜索，而不是从已排序的filteredNotes
    const baseNotes = filteredNotes.length > 0 ? filteredNotes : notes;
    const notesWithScores = baseNotes.map((note: BrewingNote) => {
      const equipment = note.equipment?.toLowerCase() || '';
      const method = note.method?.toLowerCase() || '';
      const beanName = note.coffeeBeanInfo?.name?.toLowerCase() || '';
      const roastLevel = note.coffeeBeanInfo?.roastLevel?.toLowerCase() || '';
      const notes = note.notes?.toLowerCase() || '';
      const coffee = note.params?.coffee?.toLowerCase() || '';
      const water = note.params?.water?.toLowerCase() || '';
      const ratio = note.params?.ratio?.toLowerCase() || '';
      const grindSize = note.params?.grindSize?.toLowerCase() || '';
      const temp = note.params?.temp?.toLowerCase() || '';
      const tasteInfo =
        `酸度${note.taste?.acidity || 0} 甜度${note.taste?.sweetness || 0} 苦度${note.taste?.bitterness || 0} 醇厚度${note.taste?.body || 0}`.toLowerCase();
      const dateInfo = note.timestamp
        ? new Date(note.timestamp).toLocaleDateString()
        : '';
      const totalTime = note.totalTime ? `${note.totalTime}秒` : '';
      const ratingText = note.rating
        ? `评分${note.rating} ${note.rating}分 ${note.rating}星`.toLowerCase()
        : '';

      const searchableTexts = [
        { text: beanName, weight: 3 },
        { text: equipment, weight: 2 },
        { text: method, weight: 2 },
        { text: notes, weight: 2 },
        { text: roastLevel, weight: 1 },
        { text: coffee, weight: 1 },
        { text: water, weight: 1 },
        { text: ratio, weight: 1 },
        { text: grindSize, weight: 1 },
        { text: temp, weight: 1 },
        { text: tasteInfo, weight: 1 },
        { text: dateInfo, weight: 1 },
        { text: totalTime, weight: 1 },
        { text: ratingText, weight: 1 },
      ];

      let score = 0;
      let allTermsMatch = true;

      for (const term of queryTerms) {
        const termMatches = searchableTexts.some(({ text }) =>
          text.includes(term)
        );
        if (!termMatches) {
          allTermsMatch = false;
          break;
        }

        for (const { text, weight } of searchableTexts) {
          if (text.includes(term)) {
            score += weight;
            if (text === term) {
              score += weight * 2;
            }
            if (text.startsWith(term)) {
              score += weight;
            }
          }
        }
      }

      return { note, score, matches: allTermsMatch };
    });

    type NoteWithScore = { note: BrewingNote; score: number; matches: boolean };
    const matchingNotes = notesWithScores.filter(
      (item: NoteWithScore) => item.matches
    );

    // 获取匹配的笔记
    const matchedNotesOnly = matchingNotes.map(
      (item: NoteWithScore) => item.note
    );

    // 对搜索结果应用排序选项：优先使用搜索排序，否则使用普通排序
    const effectiveSortOption = searchSortOption || sortOption;
    const sortedMatchedNotes = sortNotes(matchedNotesOnly, effectiveSortOption);

    return sortedMatchedNotes;
  }, [
    isSearching,
    searchQuery,
    filteredNotes,
    notes,
    searchSortOption,
    sortOption,
  ]);

  // 检测搜索结果中是否有萃取时间数据
  const hasExtractionTimeData = useMemo(() => {
    if (!isSearching || !searchQuery.trim()) return false;

    // 检查搜索结果中是否有至少一条笔记包含萃取时间信息
    return searchFilteredNotes.some(note => {
      const extractionTime = extractExtractionTime(note.notes || '');
      return extractionTime !== null;
    });
  }, [isSearching, searchQuery, searchFilteredNotes]);

  // 计算总咖啡消耗量
  const totalCoffeeConsumption = useRef(0);

  // 🔥 使用 ref 跟踪组件挂载状态，防止在卸载后更新状态
  const isMountedRef = useRef(false);
  const isLoadingRef = useRef(false); // 使用 ref 而不是 globalCache 来控制并发

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 简化的数据加载函数 - 参考咖啡豆的实现
  const loadNotesData = useCallback(async () => {
    // 防止并发加载
    if (isLoadingRef.current) return;

    try {
      // 如果缓存已初始化且有数据，直接使用
      if (globalCache.initialized && globalCache.notes.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📦 使用缓存的笔记数据');
        }
        setNotes(globalCache.notes);
        setEquipmentNames(globalCache.equipmentNames);
        totalCoffeeConsumption.current = globalCache.totalConsumption;
        return;
      }

      isLoadingRef.current = true;

      const { Storage } = await import('@/lib/core/storage');
      const savedNotes = await Storage.get('brewingNotes');
      const parsedNotes: BrewingNote[] = savedNotes
        ? JSON.parse(savedNotes)
        : [];

      // 检查组件是否仍然挂载
      if (!isMountedRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('组件已卸载，跳过状态更新');
        }
        return;
      }

      // 更新全局缓存
      globalCache.notes = parsedNotes;
      globalCache.lastUpdated = Date.now();
      globalCache.initialized = true;
      globalCache.totalConsumption =
        calculateTotalCoffeeConsumption(parsedNotes);

      // 更新笔记数据
      setNotes(parsedNotes);

      // 异步加载设备名称映射
      const loadEquipmentData = async () => {
        if (!isMountedRef.current) return;

        const { equipmentList } = await import('@/lib/core/config');
        const { loadCustomEquipments } = await import(
          '@/lib/managers/customEquipments'
        );
        const customEquips = await loadCustomEquipments();

        if (!isMountedRef.current) return;

        setCustomEquipments(customEquips);

        const namesMap: Record<string, string> = {};
        equipmentList.forEach(equipment => {
          namesMap[equipment.id] = equipment.name;
        });
        customEquips.forEach(equipment => {
          namesMap[equipment.id] = equipment.name;
        });

        // 更新缓存中的设备名称
        globalCache.equipmentNames = namesMap;
        setEquipmentNames(namesMap);

        // 更新总消耗量引用
        totalCoffeeConsumption.current = globalCache.totalConsumption;
      };

      // 立即加载设备数据
      loadEquipmentData();
    } catch (error) {
      console.error('加载笔记数据失败:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // 监听 isOpen 变化，打开时加载数据（参考咖啡豆实现）
  useEffect(() => {
    if (isOpen) {
      loadNotesData();
    }
  }, [isOpen, loadNotesData]);

  // 简化存储监听 - 只监听关键的数据变化事件
  // 🔥 修复事件监听器泄漏：使用 useCallback 确保引用稳定，正确移除监听器
  const debouncedLoadRef = useRef<NodeJS.Timeout | null>(null);

  // 🔥 使用 useCallback 创建稳定的事件处理函数引用
  const handleStorageChange = useCallback(
    (e: Event) => {
      const event = e as CustomEvent;
      if (event.detail?.key === 'brewingNotes') {
        // 🔥 清除缓存,强制重新加载
        globalCache.lastUpdated = 0;
        globalCache.initialized = false;

        // 清除之前的防抖定时器
        if (debouncedLoadRef.current) {
          clearTimeout(debouncedLoadRef.current);
        }

        // 使用防抖延迟加载，避免连续保存时的重复刷新
        debouncedLoadRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            loadNotesData();
          }
        }, 150); // 150ms 防抖延迟
      }
    },
    [loadNotesData]
  );

  const handleBrewingNotesUpdate = useCallback(() => {
    // 🔥 清除缓存,强制重新加载
    globalCache.lastUpdated = 0;
    globalCache.initialized = false;

    // 清除之前的防抖定时器
    if (debouncedLoadRef.current) {
      clearTimeout(debouncedLoadRef.current);
    }

    // 使用防抖延迟加载
    debouncedLoadRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        loadNotesData();
      }
    }, 150);
  }, [loadNotesData]);

  // 🔥 监听笔记数据立即更新事件 - 类似咖啡豆的实现，无延迟
  useEffect(() => {
    const handleBrewingNotesDataChanged = () => {
      // 直接使用缓存数据更新UI，因为缓存已经在保存时同步更新
      if (globalCache.initialized && globalCache.notes.length >= 0) {
        setNotes(globalCache.notes);
        setEquipmentNames(globalCache.equipmentNames);
        totalCoffeeConsumption.current = globalCache.totalConsumption;
      }
    };

    window.addEventListener(
      'brewingNotesDataChanged',
      handleBrewingNotesDataChanged
    );

    return () => {
      window.removeEventListener(
        'brewingNotesDataChanged',
        handleBrewingNotesDataChanged
      );
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // 🔥 使用稳定的函数引用，确保能正确移除
    window.addEventListener('storage:changed', handleStorageChange);
    window.addEventListener('brewingNotesUpdated', handleBrewingNotesUpdate);

    return () => {
      // 清理防抖定时器
      if (debouncedLoadRef.current) {
        clearTimeout(debouncedLoadRef.current);
        debouncedLoadRef.current = null;
      }

      // 🔥 移除事件监听器 - 使用相同的函数引用
      window.removeEventListener('storage:changed', handleStorageChange);
      window.removeEventListener(
        'brewingNotesUpdated',
        handleBrewingNotesUpdate
      );
    };
  }, [isOpen, handleStorageChange, handleBrewingNotesUpdate]);

  // 显示消息提示 - 使用 LightToast
  const showToastMessage = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    showToast({ title: message, type });
  };

  // 处理删除笔记 - 统一数据流避免竞态条件，并恢复咖啡豆容量
  const handleDelete = async (noteId: string) => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const savedNotes = await Storage.get('brewingNotes');
      if (!savedNotes) return;

      const notes = JSON.parse(savedNotes) as BrewingNote[];

      // 找到要删除的笔记
      const noteToDelete = notes.find(note => note.id === noteId);
      if (!noteToDelete) {
        console.warn('未找到要删除的笔记:', noteId);
        return;
      }

      // 添加确认对话框
      let noteName = '此笔记';
      if (noteToDelete.source === 'quick-decrement') {
        noteName = `${noteToDelete.coffeeBeanInfo?.name || '未知咖啡豆'}的快捷扣除记录`;
      } else if (noteToDelete.source === 'capacity-adjustment') {
        noteName = `${noteToDelete.coffeeBeanInfo?.name || '未知咖啡豆'}的容量调整记录`;
      } else {
        noteName = noteToDelete.method || '此笔记';
      }

      if (!window.confirm(`确认要删除"${noteName}"吗？`)) {
        return;
      }

      // 恢复咖啡豆容量（根据笔记类型采用不同的恢复策略）
      try {
        if (noteToDelete.source === 'capacity-adjustment') {
          // 处理容量调整记录的恢复（简化版本）
          const beanId = noteToDelete.beanId;
          const capacityAdjustment =
            noteToDelete.changeRecord?.capacityAdjustment;

          if (beanId && capacityAdjustment) {
            const changeAmount = capacityAdjustment.changeAmount;
            if (
              typeof changeAmount === 'number' &&
              !isNaN(changeAmount) &&
              changeAmount !== 0
            ) {
              const { CoffeeBeanManager } = await import(
                '@/lib/managers/coffeeBeanManager'
              );

              // 获取当前咖啡豆信息
              const currentBean = await CoffeeBeanManager.getBeanById(beanId);
              if (currentBean) {
                const currentRemaining = parseFloat(
                  currentBean.remaining || '0'
                );
                const restoredRemaining = currentRemaining - changeAmount; // 反向操作
                let finalRemaining = Math.max(0, restoredRemaining);

                // 确保不超过总容量
                if (currentBean.capacity) {
                  const totalCapacity = parseFloat(currentBean.capacity);
                  if (!isNaN(totalCapacity) && totalCapacity > 0) {
                    finalRemaining = Math.min(finalRemaining, totalCapacity);
                  }
                }

                const formattedRemaining =
                  CoffeeBeanManager.formatNumber(finalRemaining);
                await CoffeeBeanManager.updateBean(beanId, {
                  remaining: formattedRemaining,
                });
              }
            }
          }
        } else {
          // 处理快捷扣除记录和普通笔记的恢复
          const { extractCoffeeAmountFromNote, getNoteAssociatedBeanId } =
            await import('../utils');
          const coffeeAmount = extractCoffeeAmountFromNote(noteToDelete);
          const beanId = getNoteAssociatedBeanId(noteToDelete);

          if (beanId && coffeeAmount > 0) {
            const { CoffeeBeanManager } = await import(
              '@/lib/managers/coffeeBeanManager'
            );
            await CoffeeBeanManager.increaseBeanRemaining(beanId, coffeeAmount);
          }
        }
      } catch (error) {
        console.error('恢复咖啡豆容量失败:', error);
        // 容量恢复失败不应阻止笔记删除，但需要记录错误
      }

      // 删除笔记
      const updatedNotes = notes.filter(note => note.id !== noteId);

      // 更新全局缓存并触发事件
      const { updateBrewingNotesCache } = await import(
        '@/components/notes/List/globalCache'
      );
      await updateBrewingNotesCache(updatedNotes);

      // 直接更新本地状态
      setNotes(updatedNotes);

      // 更新总消耗量
      totalCoffeeConsumption.current = globalCache.totalConsumption;

      showToastMessage('笔记已删除', 'success');
    } catch (error) {
      console.error('删除笔记失败:', error);
      showToastMessage('删除笔记失败', 'error');
    }
  };

  // 处理复制笔记 - 打开编辑界面让用户修改后保存，不包含图片
  const handleCopyNote = async (noteId: string) => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const savedNotes = await Storage.get('brewingNotes');
      if (!savedNotes) return;

      const notes = JSON.parse(savedNotes) as BrewingNote[];
      const noteToCopy = notes.find(note => note.id === noteId);

      if (!noteToCopy) {
        console.warn('未找到要复制的笔记:', noteId);
        return;
      }

      // 创建新的笔记ID和时间戳
      const newTimestamp = Date.now();
      const newId = newTimestamp.toString();

      // 检查是否为变动记录
      const isChangeRecord =
        noteToCopy.source === 'quick-decrement' ||
        noteToCopy.source === 'capacity-adjustment';

      if (isChangeRecord) {
        // 变动记录：打开变动记录编辑界面（不包含图片）
        const changeRecordToEdit: BrewingNote = {
          ...noteToCopy,
          id: newId,
          timestamp: newTimestamp,
          image: undefined, // 不包含图片
        };
        setEditingChangeRecord(changeRecordToEdit);
        setShowChangeRecordEditModal(true);
      } else {
        // 普通笔记：打开编辑界面（不包含图片）
        // 注意：不传递 id，让表单认为这是全新的笔记，这样容量同步逻辑才能正确工作
        const noteToEdit: Partial<BrewingNoteData> = {
          timestamp: newTimestamp,
          equipment: noteToCopy.equipment,
          method: noteToCopy.method,
          params: noteToCopy.params,
          coffeeBeanInfo: noteToCopy.coffeeBeanInfo || {
            name: '',
            roastLevel: '',
          },
          image: undefined, // 不包含图片
          rating: noteToCopy.rating,
          taste: noteToCopy.taste,
          notes: noteToCopy.notes,
          totalTime: noteToCopy.totalTime,
          beanId: noteToCopy.beanId,
          // 添加一个临时 ID 用于表单提交识别，但让表单知道这是新笔记
          id: newId,
        };

        // 通过事件触发模态框打开
        window.dispatchEvent(
          new CustomEvent('brewingNoteEditOpened', {
            detail: {
              data: noteToEdit,
              isCopy: true, // 标记这是复制操作
            },
          })
        );
      }

      // 提示用户
      showToastMessage('请修改后保存', 'info');
    } catch (error) {
      console.error('复制笔记失败:', error);
      showToastMessage('复制笔记失败', 'error');
    }
  };

  // 处理笔记点击 - 区分变动记录和普通笔记，使用模态弹窗
  const handleNoteClick = (note: BrewingNote) => {
    // 检查是否为变动记录
    const isChangeRecord =
      note.source === 'quick-decrement' ||
      note.source === 'capacity-adjustment';

    if (isChangeRecord) {
      // 设置编辑变动记录并显示模态
      setEditingChangeRecord(note);
      setShowChangeRecordEditModal(true);
    } else {
      // 准备要编辑的普通笔记数据
      const noteToEdit = {
        id: note.id,
        timestamp: note.timestamp,
        equipment: note.equipment,
        method: note.method,
        params: note.params,
        coffeeBeanInfo: note.coffeeBeanInfo || {
          name: '', // 提供默认值
          roastLevel: '',
        },
        image: note.image,
        rating: note.rating,
        taste: note.taste,
        notes: note.notes,
        totalTime: note.totalTime,
        // 确保包含beanId字段，这是咖啡豆容量同步的关键
        beanId: note.beanId,
      };

      // 通过事件触发模态框打开
      window.dispatchEvent(
        new CustomEvent('brewingNoteEditOpened', {
          detail: { data: noteToEdit },
        })
      );
    }
  };

  // 处理变动记录转换为普通笔记
  const handleConvertToNormalNote = (convertedNote: BrewingNote) => {
    // 关闭变动记录编辑模态
    setEditingChangeRecord(null);
    setShowChangeRecordEditModal(false);

    // 准备普通笔记数据
    const noteToEdit = {
      id: convertedNote.id,
      timestamp: convertedNote.timestamp,
      equipment: convertedNote.equipment || '',
      method: convertedNote.method || '',
      params: convertedNote.params || {
        coffee: '',
        water: '',
        ratio: '',
        grindSize: '',
        temp: '',
      },
      coffeeBeanInfo: convertedNote.coffeeBeanInfo || {
        name: '',
        roastLevel: '',
      },
      image: convertedNote.image,
      rating: convertedNote.rating ?? 0,
      taste: convertedNote.taste || {
        acidity: 0,
        sweetness: 0,
        bitterness: 0,
        body: 0,
      },
      notes: convertedNote.notes || '',
      totalTime: convertedNote.totalTime || 0,
      beanId: convertedNote.beanId,
    };

    // 通过事件打开普通笔记编辑模态
    window.dispatchEvent(
      new CustomEvent('brewingNoteEditOpened', {
        detail: { data: noteToEdit },
      })
    );
  };

  // 处理变动记录保存
  const handleSaveChangeRecord = async (updatedRecord: BrewingNote) => {
    try {
      // 获取现有笔记
      const { Storage } = await import('@/lib/core/storage');
      const savedNotes = await Storage.get('brewingNotes');
      let parsedNotes: BrewingNote[] = savedNotes ? JSON.parse(savedNotes) : [];

      // 找到原始记录以计算容量变化差异
      const originalRecord = parsedNotes.find(
        note => note.id === updatedRecord.id
      );
      const isNewRecord = !originalRecord;

      // 同步咖啡豆容量变化
      if (updatedRecord.beanId) {
        try {
          const { CoffeeBeanManager } = await import(
            '@/lib/managers/coffeeBeanManager'
          );

          if (isNewRecord) {
            // 新记录：直接扣除咖啡豆剩余量
            if (updatedRecord.source === 'quick-decrement') {
              const decrementAmount = updatedRecord.quickDecrementAmount || 0;
              if (decrementAmount > 0) {
                await CoffeeBeanManager.updateBeanRemaining(
                  updatedRecord.beanId,
                  decrementAmount
                );
              }
            } else if (updatedRecord.source === 'capacity-adjustment') {
              const changeAmount =
                updatedRecord.changeRecord?.capacityAdjustment?.changeAmount ||
                0;
              if (Math.abs(changeAmount) > 0.01) {
                // 获取当前咖啡豆信息
                const currentBean = await CoffeeBeanManager.getBeanById(
                  updatedRecord.beanId
                );
                if (currentBean) {
                  const currentRemaining = parseFloat(
                    currentBean.remaining || '0'
                  );
                  const newRemaining = Math.max(
                    0,
                    currentRemaining + changeAmount
                  );

                  // 确保不超过总容量
                  let finalRemaining = newRemaining;
                  if (currentBean.capacity) {
                    const totalCapacity = parseFloat(currentBean.capacity);
                    if (!isNaN(totalCapacity) && totalCapacity > 0) {
                      finalRemaining = Math.min(finalRemaining, totalCapacity);
                    }
                  }

                  const formattedRemaining =
                    CoffeeBeanManager.formatNumber(finalRemaining);
                  await CoffeeBeanManager.updateBean(updatedRecord.beanId, {
                    remaining: formattedRemaining,
                  });
                }
              }
            }
          } else {
            // 更新现有记录：计算差异并调整
            let originalChangeAmount = 0;
            let newChangeAmount = 0;

            if (originalRecord.source === 'quick-decrement') {
              originalChangeAmount = -(
                originalRecord.quickDecrementAmount || 0
              );
            } else if (originalRecord.source === 'capacity-adjustment') {
              originalChangeAmount =
                originalRecord.changeRecord?.capacityAdjustment?.changeAmount ||
                0;
            }

            if (updatedRecord.source === 'quick-decrement') {
              newChangeAmount = -(updatedRecord.quickDecrementAmount || 0);
            } else if (updatedRecord.source === 'capacity-adjustment') {
              newChangeAmount =
                updatedRecord.changeRecord?.capacityAdjustment?.changeAmount ||
                0;
            }

            // 计算需要调整的容量差异
            const capacityDiff = newChangeAmount - originalChangeAmount;

            if (Math.abs(capacityDiff) > 0.01) {
              // 获取当前咖啡豆信息
              const currentBean = await CoffeeBeanManager.getBeanById(
                updatedRecord.beanId
              );
              if (currentBean) {
                const currentRemaining = parseFloat(
                  currentBean.remaining || '0'
                );
                const newRemaining = Math.max(
                  0,
                  currentRemaining + capacityDiff
                );

                // 确保不超过总容量
                let finalRemaining = newRemaining;
                if (currentBean.capacity) {
                  const totalCapacity = parseFloat(currentBean.capacity);
                  if (!isNaN(totalCapacity) && totalCapacity > 0) {
                    finalRemaining = Math.min(finalRemaining, totalCapacity);
                  }
                }

                const formattedRemaining =
                  CoffeeBeanManager.formatNumber(finalRemaining);
                await CoffeeBeanManager.updateBean(updatedRecord.beanId, {
                  remaining: formattedRemaining,
                });
              }
            }
          }
        } catch (error) {
          console.error('同步咖啡豆容量失败:', error);
          // 不阻止记录保存，但显示警告
          showToastMessage('记录已保存，但容量同步失败', 'error');
        }
      }

      // 检查记录是否已存在
      if (isNewRecord) {
        // 添加新记录
        parsedNotes = [updatedRecord, ...parsedNotes];
      } else {
        // 更新现有记录
        parsedNotes = parsedNotes.map(note => {
          if (note.id === updatedRecord.id) {
            return updatedRecord;
          }
          return note;
        });
      }

      // 更新全局缓存并触发事件
      const { updateBrewingNotesCache } = await import(
        '@/components/notes/List/globalCache'
      );
      await updateBrewingNotesCache(parsedNotes);

      // 直接更新本地状态
      setNotes(parsedNotes);

      // 更新总消耗量
      totalCoffeeConsumption.current = globalCache.totalConsumption;

      // 关闭模态和编辑状态
      setEditingChangeRecord(null);
      setShowChangeRecordEditModal(false);

      // 显示成功提示
      showToastMessage(
        isNewRecord ? '变动记录已添加' : '变动记录已更新',
        'success'
      );
    } catch (error) {
      console.error('更新变动记录失败:', error);
      showToastMessage('更新变动记录失败', 'error');
    }
  };

  // 处理添加笔记
  const handleAddNote = () => {
    if (onAddNote) {
      onAddNote();
    }
  };

  // 处理排序选项变化
  const handleSortChange = (option: typeof sortOption) => {
    setSortOption(option);
    saveSortOptionPreference(option);
    // 已保存到本地存储
    // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
    debouncedUpdateFilters({ sortOption: option });
  };

  // 处理搜索排序选项变化 - 独立于普通排序
  const handleSearchSortChange = (option: SortOption | null) => {
    setSearchSortOption(option);
    // 搜索排序不需要持久化存储，因为它是临时的
  };

  // 处理显示模式变化
  const handleViewModeChange = useCallback(
    (mode: 'list' | 'gallery') => {
      updateViewMode(mode);
    },
    [updateViewMode]
  );

  // 优雅的图片流模式切换处理
  const handleToggleImageFlowMode = useCallback(() => {
    const newMode = !isImageFlowMode;
    if (newMode) {
      // 开启普通图片流：关闭带日期模式，记住选择
      setImageFlowMode(true, false, true);
    } else {
      // 关闭图片流：回到列表模式
      setImageFlowMode(false, false, false);
      updateViewMode('list');
    }
  }, [isImageFlowMode, setImageFlowMode, updateViewMode]);

  const handleToggleDateImageFlowMode = useCallback(() => {
    const newMode = !isDateImageFlowMode;
    if (newMode) {
      // 开启带日期图片流：关闭普通模式，记住选择
      setImageFlowMode(false, true, true);
    } else {
      // 关闭图片流：回到列表模式
      setImageFlowMode(false, false, false);
      updateViewMode('list');
    }
  }, [isDateImageFlowMode, setImageFlowMode, updateViewMode]);

  // 智能切换图片流模式（用于双击"全部"）
  const handleSmartToggleImageFlow = useCallback(() => {
    const isInImageFlowMode =
      viewMode === 'gallery' && (isImageFlowMode || isDateImageFlowMode);

    if (isInImageFlowMode) {
      // 当前在图片流模式，切换到列表模式
      setImageFlowMode(false, false, false);
      updateViewMode('list');
    } else {
      // 当前在列表模式，根据记忆恢复到用户偏好的图片流模式
      const useDate = lastImageFlowType === 'date';
      setImageFlowMode(!useDate, useDate, false); // 不更新记忆，因为这是恢复操作
    }
  }, [
    viewMode,
    isImageFlowMode,
    isDateImageFlowMode,
    lastImageFlowType,
    setImageFlowMode,
    updateViewMode,
  ]);

  // 处理过滤模式变化
  const handleFilterModeChange = (mode: 'equipment' | 'bean' | 'date') => {
    setFilterMode(mode);
    saveFilterModePreference(mode);
    // 已保存到本地存储
    // 切换模式时清空选择
    setSelectedEquipment(null);
    setSelectedBean(null);
    setSelectedDate(null);
    saveSelectedEquipmentPreference(null);
    saveSelectedBeanPreference(null);
    saveSelectedDatePreference(null);
    globalCache.selectedEquipment = null;
    globalCache.selectedBean = null;
    globalCache.selectedDate = null;
    // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
    debouncedUpdateFilters({
      filterMode: mode,
      selectedEquipment: null,
      selectedBean: null,
      selectedDate: null,
    });
  };

  // 处理设备选择变化
  const handleEquipmentClick = useCallback(
    (equipment: string | null) => {
      setSelectedEquipment(equipment);
      saveSelectedEquipmentPreference(equipment);
      // 已保存到本地存储
      // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
      debouncedUpdateFilters({ selectedEquipment: equipment });
    },
    [debouncedUpdateFilters]
  );

  // 处理咖啡豆选择变化
  const handleBeanClick = useCallback(
    (bean: string | null) => {
      setSelectedBean(bean);
      saveSelectedBeanPreference(bean);
      // 已保存到本地存储
      // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
      debouncedUpdateFilters({ selectedBean: bean });
    },
    [debouncedUpdateFilters]
  );

  // 处理日期选择变化
  const handleDateClick = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
      saveSelectedDatePreference(date);
      // 已保存到本地存储
      // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
      debouncedUpdateFilters({ selectedDate: date });
    },
    [debouncedUpdateFilters]
  );

  // 处理日期分组模式变化
  const handleDateGroupingModeChange = useCallback(
    (mode: DateGroupingMode) => {
      setDateGroupingMode(mode);
      saveDateGroupingModePreference(mode);
      // 已保存到本地存储
      // 切换粒度时清空选择的日期，因为格式会改变
      setSelectedDate(null);
      saveSelectedDatePreference(null);
      globalCache.dateGroupingMode = mode;
      globalCache.selectedDate = null;
      // 数据筛选由 useEnhancedNotesFiltering Hook 自动处理
      debouncedUpdateFilters({ dateGroupingMode: mode, selectedDate: null });
    },
    [debouncedUpdateFilters]
  );

  // 处理笔记选择/取消选择
  const handleToggleSelect = (noteId: string, enterShareMode = false) => {
    // 如果需要进入分享模式
    if (enterShareMode && !isShareMode) {
      setIsShareMode(true);
      setSelectedNotes([noteId]);
      return;
    }

    // 在已有选择中切换选中状态
    setSelectedNotes(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId);
      } else {
        return [...prev, noteId];
      }
    });
  };

  // 取消分享模式
  const handleCancelShare = () => {
    setIsShareMode(false);
    setSelectedNotes([]);
  };

  // 保存并分享笔记截图
  const handleSaveNotes = async () => {
    if (selectedNotes.length === 0 || isSaving) return;

    setIsSaving(true);

    try {
      // 调用导出组件函数
      await exportSelectedNotes({
        selectedNotes,
        notesContainerRef,
        onSuccess: message => showToastMessage(message, 'success'),
        onError: message => showToastMessage(message, 'error'),
        onComplete: () => {
          setIsSaving(false);
          handleCancelShare();
        },
      });
    } catch (error) {
      console.error('导出笔记失败:', error);
      showToastMessage('导出笔记失败', 'error');
      setIsSaving(false);
    }
  };

  // 处理搜索按钮点击
  const handleSearchClick = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      // 退出搜索时：清空搜索查询并重置搜索排序状态
      setSearchQuery('');
      setSearchSortOption(null);
    }
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 处理搜索框键盘事件
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearching(false);
      setSearchQuery('');
      setSearchSortOption(null); // 重置搜索排序状态
    }
  };

  // 处理搜索历史点击
  const handleSearchHistoryClick = (query: string) => {
    setSearchQuery(query);
  };

  // 自动添加搜索历史 - 延迟1秒后添加
  useEffect(() => {
    if (!isSearching || !searchQuery.trim()) return;

    const timer = setTimeout(() => {
      addSearchHistory(searchQuery.trim());
      setSearchHistory(getSearchHistoryPreference());
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearching]);

  // 计算当前显示的消耗量 - 使用Hook提供的数据
  const currentConsumption = useMemo(() => {
    // 搜索状态下，计算搜索结果的消耗量
    if (isSearching && searchQuery.trim()) {
      return calculateTotalCoffeeConsumption(searchFilteredNotes);
    }

    // 其他情况使用Hook计算的总消耗量
    return totalConsumption;
  }, [isSearching, searchQuery, searchFilteredNotes, totalConsumption]);

  // 计算图片流模式下的统计信息
  const imageFlowStats = useMemo(() => {
    if (!isImageFlowMode && !isDateImageFlowMode) {
      return null;
    }

    // 获取当前显示的笔记（搜索模式下使用搜索结果，否则使用筛选结果）
    const currentNotes =
      isSearching && searchQuery.trim() ? searchFilteredNotes : filteredNotes;

    // 过滤出有图片的笔记
    const notesWithImages = currentNotes.filter(
      note => note.image && note.image.trim() !== ''
    );

    // 计算有图片笔记的消耗量
    const imageNotesConsumption =
      calculateTotalCoffeeConsumption(notesWithImages);

    return {
      count: notesWithImages.length,
      consumption: imageNotesConsumption,
      notes: notesWithImages,
    };
  }, [
    isImageFlowMode,
    isDateImageFlowMode,
    isSearching,
    searchQuery,
    searchFilteredNotes,
    filteredNotes,
  ]);

  // 计算是否有图片笔记（用于禁用/启用图片流按钮）
  const hasImageNotes = useMemo(() => {
    // 基于所有原始笔记数据检查是否有图片
    const allOriginalNotes = globalCache.notes;
    return allOriginalNotes.some(
      note => note.image && note.image.trim() !== ''
    );
  }, [notes]); // 依赖notes以便在笔记数据变化时重新计算

  // 计算图片流模式下的可用设备和豆子列表
  const imageFlowAvailableOptions = useMemo(() => {
    if (!isImageFlowMode && !isDateImageFlowMode) {
      return {
        equipments: availableEquipments,
        beans: availableBeans,
      };
    }

    // 基于原始的所有笔记数据来计算有图片的分类选项
    // 这样确保即使选择了某个分类，其他分类选项仍然可见
    const allOriginalNotes = globalCache.notes; // 使用原始的、未经筛选的笔记数据

    // 如果是搜索模式，基于搜索结果；否则基于所有原始笔记
    const baseNotes =
      isSearching && searchQuery.trim()
        ? searchFilteredNotes
        : allOriginalNotes;

    // 过滤出有图片的记录
    const allNotesWithImages = baseNotes.filter(
      note => note.image && note.image.trim() !== ''
    );

    // 获取有图片记录的设备列表
    const equipmentSet = new Set<string>();
    allNotesWithImages.forEach(note => {
      if (note.equipment) {
        equipmentSet.add(note.equipment);
      }
    });

    // 获取有图片记录的豆子列表
    const beanSet = new Set<string>();
    allNotesWithImages.forEach(note => {
      if (note.coffeeBeanInfo?.name) {
        beanSet.add(note.coffeeBeanInfo.name);
      }
    });

    return {
      equipments: Array.from(equipmentSet).sort(),
      beans: Array.from(beanSet).sort(),
    };
  }, [
    isImageFlowMode,
    isDateImageFlowMode,
    isSearching,
    searchQuery,
    searchFilteredNotes,
    availableEquipments,
    availableBeans,
  ]);

  // 在图片流模式下，如果当前选中的设备或豆子没有图片记录，自动切换到"全部"
  useEffect(() => {
    if (!imageFlowStats) return;

    const { equipments, beans } = imageFlowAvailableOptions;

    // 检查当前选中的设备是否在有图片的设备列表中
    if (
      filterMode === 'equipment' &&
      selectedEquipment &&
      !equipments.includes(selectedEquipment)
    ) {
      handleEquipmentClick(null);
    }

    // 检查当前选中的豆子是否在有图片的豆子列表中
    if (
      filterMode === 'bean' &&
      selectedBean &&
      !beans.includes(selectedBean)
    ) {
      handleBeanClick(null);
    }
  }, [
    imageFlowStats,
    imageFlowAvailableOptions,
    filterMode,
    selectedEquipment,
    selectedBean,
    handleEquipmentClick,
    handleBeanClick,
  ]);

  // 当没有图片笔记时，自动关闭图片流模式并切换回列表模式
  // 但只在数据已经加载完成后才执行此检查，避免初始化时误判
  useEffect(() => {
    // 只有当数据已经初始化且确实没有图片笔记时才关闭
    if (
      globalCache.initialized &&
      imageFlowStats &&
      imageFlowStats.count === 0 &&
      notes.length > 0
    ) {
      // 关闭所有图片流模式
      setImageFlowMode(false, false, false);
      updateViewMode('list');
    }
  }, [imageFlowStats, setImageFlowMode, updateViewMode, notes.length]);

  if (!isOpen) return null;

  return (
    <>
      {/* 主要内容区域 - 始终显示笔记列表 */}
      <div className="sticky top-0 flex-none space-y-6 bg-neutral-50 pt-6 dark:bg-neutral-900">
        {/* 数量显示 */}
        <div className="mb-6 flex items-center justify-between px-6">
          <div className="text-xs font-medium tracking-wide break-words text-neutral-800 dark:text-neutral-100">
            {(() => {
              // 图片流模式下显示有图片的记录统计
              if (imageFlowStats) {
                return imageFlowStats.count === 0
                  ? ''
                  : `${imageFlowStats.count} 条图片记录，已消耗 ${formatConsumption(imageFlowStats.consumption)}`;
              }

              // 如果没有任何笔记数据，不显示统计信息
              if (notes.length === 0) {
                return '';
              }

              // 普通模式下显示总记录统计
              // 搜索模式：显示搜索结果的统计
              if (isSearching && searchQuery.trim()) {
                return `${searchFilteredNotes.length} 条记录，已消耗 ${formatConsumption(currentConsumption)}`;
              }

              // 普通模式：显示当前筛选结果的统计
              return `${totalCount} 条记录，已消耗 ${formatConsumption(currentConsumption)}`;
            })()}
          </div>
        </div>

        {/* 设备筛选选项卡 */}
        <FilterTabs
          filterMode={filterMode}
          selectedEquipment={selectedEquipment}
          selectedBean={selectedBean}
          selectedDate={selectedDate}
          dateGroupingMode={dateGroupingMode}
          availableEquipments={imageFlowAvailableOptions.equipments}
          availableBeans={imageFlowAvailableOptions.beans}
          availableDates={availableDates}
          equipmentNames={equipmentNames}
          onFilterModeChange={handleFilterModeChange}
          onEquipmentClick={handleEquipmentClick}
          onBeanClick={handleBeanClick}
          onDateClick={handleDateClick}
          onDateGroupingModeChange={handleDateGroupingModeChange}
          isSearching={isSearching}
          searchQuery={searchQuery}
          onSearchClick={handleSearchClick}
          onSearchChange={handleSearchChange}
          onSearchKeyDown={handleSearchKeyDown}
          sortOption={sortOption}
          onSortChange={handleSortChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isImageFlowMode={isImageFlowMode}
          onToggleImageFlowMode={handleToggleImageFlowMode}
          isDateImageFlowMode={isDateImageFlowMode}
          onToggleDateImageFlowMode={handleToggleDateImageFlowMode}
          onSmartToggleImageFlow={handleSmartToggleImageFlow}
          hasImageNotes={hasImageNotes}
          settings={settings}
          hasExtractionTimeData={hasExtractionTimeData}
          searchSortOption={searchSortOption || undefined}
          onSearchSortChange={handleSearchSortChange}
          searchHistory={searchHistory}
          onSearchHistoryClick={handleSearchHistoryClick}
        />
      </div>

      <div
        className="scroll-with-bottom-bar h-full w-full overflow-y-auto"
        ref={notesContainerRef}
      >
        {/* 笔记列表视图 - 始终传递正确的笔记数据 */}
        <ListView
          selectedEquipment={selectedEquipment}
          selectedBean={selectedBean}
          filterMode={filterMode}
          onNoteClick={handleNoteClick}
          onDeleteNote={handleDelete}
          onCopyNote={handleCopyNote}
          isShareMode={isShareMode}
          selectedNotes={selectedNotes}
          onToggleSelect={handleToggleSelect}
          searchQuery={searchQuery}
          isSearching={isSearching}
          preFilteredNotes={
            isSearching && searchQuery.trim()
              ? searchFilteredNotes
              : filteredNotes
          }
          viewMode={viewMode}
          isDateImageFlowMode={isDateImageFlowMode}
          scrollParentRef={notesContainerRef.current || undefined}
          equipmentNames={equipmentNames}
          beanPrices={{}}
        />
      </div>

      {/* 底部操作栏 - 分享模式下显示保存和取消按钮，图片流模式下隐藏添加按钮 */}
      {isShareMode ? (
        <div className="bottom-action-bar">
          <div className="pointer-events-none absolute right-0 bottom-full left-0 h-12 bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900"></div>
          <div className="pb-safe-bottom relative mx-auto flex max-w-[500px] items-center bg-neutral-50 dark:bg-neutral-900">
            <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
            <button
              onClick={handleCancelShare}
              className="mx-3 flex items-center justify-center text-xs font-medium text-neutral-600 hover:opacity-80 dark:text-neutral-400"
            >
              取消
            </button>
            <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
            <button
              onClick={handleSaveNotes}
              disabled={selectedNotes.length === 0 || isSaving}
              className={`mx-3 flex items-center justify-center text-xs font-medium text-neutral-600 hover:opacity-80 dark:text-neutral-400 ${
                selectedNotes.length === 0 || isSaving
                  ? 'cursor-not-allowed opacity-50'
                  : ''
              }`}
            >
              {isSaving ? '生成中...' : `保存为图片 (${selectedNotes.length})`}
            </button>
            <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
          </div>
        </div>
      ) : (
        !isImageFlowMode &&
        !isDateImageFlowMode && <AddNoteButton onAddNote={handleAddNote} />
      )}

      {/* 变动记录编辑模态 */}
      {editingChangeRecord && (
        <ChangeRecordEditModal
          showModal={showChangeRecordEditModal}
          initialData={editingChangeRecord}
          onSave={handleSaveChangeRecord}
          onConvertToNormalNote={handleConvertToNormalNote}
          onClose={() => {
            setEditingChangeRecord(null);
            setShowChangeRecordEditModal(false);
          }}
          settings={settings}
        />
      )}
    </>
  );
};

export default BrewingHistory;
