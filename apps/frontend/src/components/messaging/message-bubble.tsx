'use client';

import { useState } from 'react';
import {
  Check,
  MoreHorizontal,
  Pencil,
  Reply,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  aggregateReactions,
  formatMessageTime,
  initialOf,
  POPULAR_EMOJIS,
  type Message,
} from '@/lib/messaging';

interface MessageBubbleProps {
  message: Message;
  own: boolean;
  selfId: string | null;
  grouped: boolean;
  isEditing: boolean;
  editContent: string;
  reactionPickerOpen: boolean;
  contextMenuOpen: boolean;
  onEditChange: (value: string) => void;
  onStartEdit: (message: Message) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (message: Message) => void;
  onReply: (message: Message) => void;
  onToggleReactionPicker: (id: string | null) => void;
  onToggleReaction: (id: string, emoji: string) => void;
  onToggleContextMenu: (id: string) => void;
}

export function MessageBubble({
  message,
  own,
  selfId,
  grouped,
  isEditing,
  editContent,
  reactionPickerOpen,
  contextMenuOpen,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onReply,
  onToggleReactionPicker,
  onToggleReaction,
  onToggleContextMenu,
}: MessageBubbleProps) {
  const time = formatMessageTime(message.createdAt);
  const isPending = message._pending === true;
  const isReply = Boolean(message.replyTo);
  const isEdited = Boolean(message.editedAt);
  const reactions = aggregateReactions(message.reactions, selfId);
  const showHeader = !grouped || isReply;
  const avatarUrl = message.user?.avatarUrl || null;

  return (
    <div
      className={cn(
        'group flex w-full items-end gap-2 px-2',
        own ? 'flex-row-reverse' : 'flex-row',
        grouped ? 'mt-0.5' : 'mt-3',
        isPending && 'opacity-70',
      )}
    >
      {!own &&
        (showHeader ? (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialOf(message.user?.displayName)
            )}
          </div>
        ) : (
          <div className="w-9 flex-shrink-0" aria-hidden />
        ))}

      <div
        className={cn(
          'flex min-w-0 max-w-[min(78%,32rem)] flex-col',
          own ? 'items-end' : 'items-start',
        )}
      >
        {!own && showHeader && (
          <div className="mb-1 flex items-baseline gap-2 px-1">
            <span className="text-xs font-semibold text-foreground/80">
              {message.user?.displayName || 'Unknown'}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground">{time}</span>
          </div>
        )}

        {isReply && message.replyTo && (
          <div
            className={cn(
              'mb-1 max-w-full rounded-md border-l-2 border-primary bg-primary/10 px-2.5 py-1.5',
              own && 'border-primary-foreground/40 bg-primary-foreground/10',
            )}
          >
            <p className="text-[0.6875rem] font-semibold text-primary">
              {message.replyTo.user?.displayName || 'Unknown'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {message.replyTo.content}
            </p>
          </div>
        )}

        <div
          className={cn(
            'relative inline-block w-fit max-w-full break-words rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-relaxed shadow-sm',
            own
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-card-foreground',
            grouped && (own ? 'rounded-tr-md' : 'rounded-tl-md'),
          )}
        >
          {own && (
            <span className="mb-0.5 block text-right text-[0.625rem] font-medium opacity-80">
              {time}
            </span>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editContent}
                autoFocus
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSaveEdit(message.id);
                  } else if (e.key === 'Escape') {
                    onCancelEdit();
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onSaveEdit(message.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:brightness-110"
                  aria-label="Save edit"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/70"
                  aria-label="Cancel edit"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <span className="whitespace-pre-wrap">
              {message.content}
              {isEdited && (
                <span className="ml-1.5 text-[0.6875rem] italic opacity-70">
                  (edited)
                </span>
              )}
              {isPending && (
                <span className="ml-1.5 text-[0.6875rem] italic opacity-70">
                  sending…
                </span>
              )}
            </span>
          )}
        </div>

        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(message.id, r.emoji)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition',
                  r.reactedByMe
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {reactionPickerOpen && (
          <div
            className="mt-1 z-[9999] flex flex-wrap gap-1 rounded-lg border border-border bg-popover p-1.5 shadow-md"
            data-reaction-picker
            onMouseEnter={(e) => e.stopPropagation()}
          >
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(message.id, emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition hover:scale-110 hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isPending && !isEditing && (
        <div
          className={cn(
            'relative self-center opacity-0 transition group-hover:opacity-100',
            contextMenuOpen && 'opacity-100',
          )}
          data-message-actions
        >
          <button
            type="button"
            onClick={() => onToggleContextMenu(message.id)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground',
              contextMenuOpen && 'bg-muted text-foreground',
            )}
            aria-label="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {contextMenuOpen && (
            <div
              className={cn(
                'absolute top-8 z-[9999] min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-lg',
                own ? 'right-0' : 'left-0',
              )}
              data-context-menu
              onMouseEnter={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onReply(message)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-popover-foreground transition hover:bg-muted"
              >
                <Reply className="h-4 w-4" /> Reply
              </button>
              <button
                type="button"
                onClick={() => onToggleReactionPicker(message.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-popover-foreground transition hover:bg-muted"
              >
                <Smile className="h-4 w-4" /> React
              </button>
              {own && (
                <>
                  <button
                    type="button"
                    onClick={() => onStartEdit(message)}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-popover-foreground transition hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(message)}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
