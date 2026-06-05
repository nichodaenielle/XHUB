'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/store/auth.store';
import { workspacesApi, channelsApi } from '@/lib/api';
import ChannelList from '@/components/dashboard/ChannelList';
import MessageThread from '@/components/dashboard/MessageThread';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const data = await workspacesApi.getWorkspaces();
      setWorkspaces(data);
      if (data.length > 0) {
        setSelectedWorkspace(data[0]);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (channel: any) => {
    setSelectedChannel(channel);
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">XHUB</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {user?.displayName || user?.email}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : workspaces.length === 0 ? (
              <div className="p-4 text-gray-500 dark:text-gray-400">No workspaces found</div>
            ) : (
              <ChannelList 
                workspaces={workspaces}
                selectedChannel={selectedChannel}
                onChannelSelect={handleChannelSelect}
              />
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedChannel ? (
            <>
              <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  #{selectedChannel.name}
                </h2>
              </div>
              
              <MessageThread channelId={selectedChannel.id} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">
                Select a channel to start messaging
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
