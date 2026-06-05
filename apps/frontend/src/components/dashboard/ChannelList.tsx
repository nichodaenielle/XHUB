'use client';

import { useState, useEffect } from 'react';
import { channelsApi } from '@/lib/api';

interface Channel {
  id: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DIRECT' | 'GROUP';
  unreadCount?: number;
}

interface Workspace {
  id: string;
  name: string;
  slug?: string;
  externalId?: string;
}

interface ChannelListProps {
  workspaces: Workspace[];
  selectedChannel: any;
  onChannelSelect: (channel: any) => void;
}

export default function ChannelList({ workspaces, selectedChannel, onChannelSelect }: ChannelListProps) {
  const [workspaceChannels, setWorkspaceChannels] = useState<Record<string, Channel[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    workspaces.forEach((workspace) => {
      loadChannels(workspace.id);
    });
  }, [workspaces]);

  const loadChannels = async (workspaceId: string) => {
    setLoading((prev) => ({ ...prev, [workspaceId]: true }));
    try {
      const channels = await channelsApi.getWorkspaceChannels(workspaceId);
      setWorkspaceChannels((prev) => ({ ...prev, [workspaceId]: channels }));
    } catch (error) {
      console.error(`Failed to load channels for workspace ${workspaceId}:`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [workspaceId]: false }));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {workspaces.map((workspace) => (
        <div key={workspace.id} className="mb-4">
          <div className="px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {workspace.name}
            </h3>
          </div>
          {loading[workspace.id] ? (
            <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">Loading channels...</div>
          ) : workspaceChannels[workspace.id]?.length === 0 ? (
            <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">No channels</div>
          ) : (
            workspaceChannels[workspace.id]?.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel)}
                className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors ${
                  selectedChannel?.id === channel.id
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span className="text-gray-400">#</span>
                  <span>{channel.name}</span>
                </span>
                {channel.unreadCount && channel.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {channel.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
