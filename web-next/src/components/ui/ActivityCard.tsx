'use client'

import { motion } from 'framer-motion'
import { useJarvisStore } from '@/store/jarvis-store'

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY CARD - Minimal, High-Contrast Design
// Strong glassmorphism for readability, no decorative clutter
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ActivityCardProps {
  message: Message
  index: number
}

export function ActivityCard({ message, index }: ActivityCardProps) {
  const theme = useJarvisStore((s) => s.theme)
  const isDark = theme === 'dark'
  const isUser = message.role === 'user'

  // Format relative time
  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 60) return 'now'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    return new Date(timestamp).toLocaleDateString()
  }

  // Truncate for preview
  const truncate = (text: string, max = 120) =>
    text.length <= max ? text : text.slice(0, max).trim() + '...'

  return (
    <motion.div
      className={isUser ? 'ml-auto' : 'mr-auto'}
      style={{ maxWidth: '90%' }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* Card with strong glassmorphism */}
      <div
        className={`
          rounded-2xl px-4 py-3
          backdrop-blur-xl backdrop-saturate-150
          ${isDark
            ? isUser
              ? 'bg-white/[0.08] border border-white/[0.12]'
              : 'bg-white/[0.05] border border-white/[0.08]'
            : isUser
              ? 'bg-slate-900/[0.06] border border-slate-900/[0.1]'
              : 'bg-slate-900/[0.03] border border-slate-900/[0.06]'
          }
        `}
      >
        {/* Minimal header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`text-[10px] font-medium tracking-wide uppercase ${
              isDark
                ? isUser ? 'text-blue-300/70' : 'text-cyan-300/70'
                : isUser ? 'text-blue-600/70' : 'text-cyan-700/70'
            }`}
          >
            {isUser ? 'You' : 'Jarvis'}
          </span>
          <span
            className={`text-[9px] font-mono ml-auto ${
              isDark ? 'text-white/25' : 'text-slate-600/40'
            }`}
          >
            {getRelativeTime(message.timestamp)}
          </span>
        </div>

        {/* High-contrast message text */}
        <p
          className={`text-sm leading-relaxed ${
            isDark
              ? 'text-white/90'  // High contrast on dark
              : 'text-slate-800' // High contrast on light
          }`}
        >
          {truncate(message.content)}
        </p>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED - Fades to low opacity when idle
// No decorative dividers - let spacing define sections
// ═══════════════════════════════════════════════════════════════════════════════

interface ActivityFeedProps {
  maxMessages?: number
  className?: string
}

export function ActivityFeed({ maxMessages = 3, className = '' }: ActivityFeedProps) {
  const messages = useJarvisStore((s) => s.messages)
  const state = useJarvisStore((s) => s.state)

  // Get the most recent messages (reversed for newest first)
  const recentMessages = messages.slice(-maxMessages).reverse()

  if (recentMessages.length === 0) {
    return null
  }

  // Fade to 20% when system is idle (per creative director feedback)
  const isIdle = state === 'idle'

  return (
    <motion.div
      className={`flex flex-col gap-2 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: isIdle ? 0.25 : 0.9 }}
      transition={{ duration: 0.5 }}
    >
      {recentMessages.map((message, index) => (
        <ActivityCard key={message.id} message={message} index={index} />
      ))}
    </motion.div>
  )
}
