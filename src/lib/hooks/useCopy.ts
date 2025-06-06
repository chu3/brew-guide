"use client"

import { useState } from "react"
import { copyToClipboard } from "@/lib/utils/exportUtils"
import { showToast } from "@/components/common/feedback/GlobalToast"
import { useTranslations } from 'next-intl'

interface UseCopyResult {
  copyText: (text: string) => Promise<void>
  showFailureModal: boolean
  failureContent: string | null
  closeFailureModal: () => void
}

export function useCopy(): UseCopyResult {
  const t = useTranslations('nav')
  const [showFailureModal, setShowFailureModal] = useState(false)
  const [failureContent, setFailureContent] = useState<string | null>(null)

  const copyText = async (text: string) => {
    const result = await copyToClipboard(text)

    if (result.success) {
      showToast({
        type: "success",
        title: t('messages.copiedToClipboard'),
        duration: 2000,
      })
    } else {
      setFailureContent(result.content || text)
      setShowFailureModal(true)
    }
  }

  const closeFailureModal = () => {
    setShowFailureModal(false)
    setFailureContent(null)
  }

  return {
    copyText,
    showFailureModal,
    failureContent,
    closeFailureModal,
  }
} 