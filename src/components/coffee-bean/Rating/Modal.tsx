'use client';

import React, { useState, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import StarRating from '../ui/StarRating';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';

interface CoffeeBeanRatingModalProps {
  showModal: boolean;
  coffeeBean: CoffeeBean | null;
  onClose: () => void;
  onSave: (id: string, ratings: Partial<CoffeeBean>) => void;
  onAfterSave?: () => void;
}

const CoffeeBeanRatingModal: React.FC<CoffeeBeanRatingModalProps> = ({
  showModal,
  coffeeBean,
  onClose,
  onSave,
  onAfterSave,
}) => {
  const [beanType, setBeanType] = useState<'espresso' | 'filter'>('filter');
  const [overallRating, setOverallRating] = useState<number>(0);
  const [ratingNotes, setRatingNotes] = useState<string>('');

  // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!showModal) return;

    // 添加模态框历史记录
    window.history.pushState({ modal: 'bean-rating' }, '');

    // 监听返回事件
    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showModal, onClose]);

  // 当咖啡豆数据加载时，初始化表单状态
  useEffect(() => {
    if (coffeeBean) {
      setBeanType(coffeeBean.beanType || 'filter');
      setOverallRating(coffeeBean.overallRating || 0);
      setRatingNotes(coffeeBean.ratingNotes || '');
    }
  }, [coffeeBean]);

  const handleSave = async () => {
    if (!coffeeBean) return;

    const ratings: Partial<CoffeeBean> = {
      beanType,
      overallRating,
      ratingNotes: ratingNotes.trim() || undefined,
    };

    try {
      // 先保存数据
      await onSave(coffeeBean.id, ratings);

      // 保存成功后再调用回调函数
      if (onAfterSave) {
        // 延迟50ms确保数据已更新
        setTimeout(() => {
          onAfterSave();
        }, 50);
      }
    } catch (error) {
      console.error('保存评分失败:', error);
    }
  };

  // 处理关闭
  const handleClose = () => {
    // 如果历史栈中有我们添加的条目，触发返回
    if (window.history.state?.modal === 'bean-rating') {
      window.history.back();
    } else {
      // 否则直接关闭
      onClose();
    }
  };

  // 当没有咖啡豆数据时不渲染
  if (!coffeeBean) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${
        showModal
          ? 'pointer-events-auto bg-black/50 opacity-100'
          : 'pointer-events-none opacity-0'
      } `}
    >
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-[500px] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] dark:bg-neutral-900 ${showModal ? 'translate-y-0' : 'translate-y-full'} `}
        style={{
          willChange: 'transform',
        }}
      >
        {/* 拖动条 */}
        <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
          <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>

        {/* 表单内容 */}
        <div className="pb-safe-bottom max-h-[calc(90vh-40px)] overflow-auto px-6">
          <div className="mx-auto max-w-md space-y-6 py-4">
            {/* 豆子名称和类型 */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide">
                {coffeeBean.name}
              </h3>
            </div>

            {/* 总体评分 */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                评分
              </label>
              <StarRating
                value={overallRating}
                onChange={setOverallRating}
                size="lg"
                color="text-amber-500"
              />
            </div>

            {/* 评价备注 */}
            <div className="w-full space-y-2">
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                备注
              </label>
              <AutoResizeTextarea
                value={ratingNotes}
                onChange={e => setRatingNotes(e.target.value)}
                placeholder="添加对这款咖啡豆的备注"
                className="w-full border-b border-neutral-300 bg-transparent py-2 outline-hidden focus:border-neutral-800 dark:border-neutral-700 dark:focus:border-neutral-400"
                minRows={2}
                maxRows={6}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-3 pt-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-md border border-neutral-200 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  handleClose();
                }}
                className="flex-1 rounded-md bg-neutral-900 py-2 text-xs text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoffeeBeanRatingModal;
