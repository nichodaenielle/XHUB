import { Injectable } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SearchService {
  private meiliSearch: MeiliSearch;
  private messageIndex: string;
  private userIndex: string;
  private channelIndex: string;

  constructor(private configService: ConfigService) {
    this.meiliSearch = new MeiliSearch({
      host: this.configService.get('MEILISEARCH_HOST'),
      apiKey: this.configService.get('MEILISEARCH_API_KEY'),
    });

    this.messageIndex = 'messages';
    this.userIndex = 'users';
    this.channelIndex = 'channels';

    this.initializeIndexes();
  }

  private async initializeIndexes() {
    try {
      // Create indexes if they don't exist
      await this.meiliSearch.createIndex(this.messageIndex, { primaryKey: 'id' });
      await this.meiliSearch.createIndex(this.userIndex, { primaryKey: 'id' });
      await this.meiliSearch.createIndex(this.channelIndex, { primaryKey: 'id' });

      // Configure searchable attributes
      await this.meiliSearch.index(this.messageIndex).updateSettings({
        searchableAttributes: ['content'],
        filterableAttributes: ['channelId', 'workspaceId', 'userId'],
        sortableAttributes: ['createdAt'],
      });

      await this.meiliSearch.index(this.userIndex).updateSettings({
        searchableAttributes: ['username', 'displayName'],
        filterableAttributes: ['status'],
      });

      await this.meiliSearch.index(this.channelIndex).updateSettings({
        searchableAttributes: ['name', 'description', 'topic'],
        filterableAttributes: ['workspaceId', 'type'],
      });
    } catch (error) {
      // Indexes might already exist
      console.log('Search indexes initialization:', error.message);
    }
  }

  async indexMessage(message: any) {
    await this.meiliSearch.index(this.messageIndex).addDocuments([
      {
        id: message.id,
        content: message.content,
        channelId: message.channelId,
        userId: message.userId,
        username: message.user?.username,
        createdAt: message.createdAt,
      },
    ]);
  }

  async indexUser(user: any) {
    await this.meiliSearch.index(this.userIndex).addDocuments([
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        status: user.status,
      },
    ]);
  }

  async indexChannel(channel: any) {
    await this.meiliSearch.index(this.channelIndex).addDocuments([
      {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        topic: channel.topic,
        workspaceId: channel.workspaceId,
        type: channel.type,
      },
    ]);
  }

  async searchMessages(query: string, filters?: any) {
    const searchParams: any = {
      limit: 50,
    };

    if (filters) {
      searchParams.filter = Object.entries(filters)
        .map(([key, value]) => `${key} = ${value}`)
        .join(' AND ');
    }

    const results = await this.meiliSearch
      .index(this.messageIndex)
      .search(query, searchParams);

    return results.hits;
  }

  async searchUsers(query: string, filters?: any) {
    const searchParams: any = {
      limit: 20,
    };

    if (filters) {
      searchParams.filter = Object.entries(filters)
        .map(([key, value]) => `${key} = ${value}`)
        .join(' AND ');
    }

    const results = await this.meiliSearch.index(this.userIndex).search(query, searchParams);

    return results.hits;
  }

  async searchChannels(query: string, filters?: any) {
    const searchParams: any = {
      limit: 20,
    };

    if (filters) {
      searchParams.filter = Object.entries(filters)
        .map(([key, value]) => `${key} = ${value}`)
        .join(' AND ');
    }

    const results = await this.meiliSearch
      .index(this.channelIndex)
      .search(query, searchParams);

    return results.hits;
  }

  async searchAll(query: string, workspaceId?: string) {
    const [messages, users, channels] = await Promise.all([
      this.searchMessages(query, workspaceId ? { workspaceId } : undefined),
      this.searchUsers(query),
      this.searchChannels(query, workspaceId ? { workspaceId } : undefined),
    ]);

    return {
      messages,
      users,
      channels,
    };
  }

  async deleteDocument(index: string, id: string) {
    await this.meiliSearch.index(index).deleteDocument(id);
  }
}
