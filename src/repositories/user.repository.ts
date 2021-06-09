import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, HasManyThroughRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {User, UserRelations, Experience, Comment, SavedExperience, UserCredential, Post, Like, Conversation, Friend, DetailTransaction, Token, UserToken} from '../models';
import {ExperienceRepository} from './experience.repository';
import {CommentRepository} from './comment.repository';
import {SavedExperienceRepository} from './saved-experience.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {PostRepository} from './post.repository';
import {LikeRepository} from './like.repository';
import {ConversationRepository} from './conversation.repository';
import {FriendRepository} from './friend.repository';
import {DetailTransactionRepository} from './detail-transaction.repository';
import {UserTokenRepository} from './user-token.repository';
import {TokenRepository} from './token.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {

  public readonly experiences: HasManyRepositoryFactory<Experience, typeof User.prototype.id>;

  public readonly comments: HasManyRepositoryFactory<Comment, typeof User.prototype.id>;

  public readonly savedExperiences: HasManyThroughRepositoryFactory<Experience, typeof Experience.prototype.id,
          SavedExperience,
          typeof User.prototype.id
        >;

  public readonly userCredentials: HasManyRepositoryFactory<UserCredential, typeof User.prototype.id>;

  public readonly posts: HasManyRepositoryFactory<Post, typeof User.prototype.id>;

  public readonly likes: HasManyRepositoryFactory<Like, typeof User.prototype.id>;

  public readonly conversations: HasManyRepositoryFactory<Conversation, typeof User.prototype.id>;

  public readonly friends: HasManyThroughRepositoryFactory<User, typeof User.prototype.id,
          Friend,
          typeof User.prototype.id
        >;

  public readonly detailTransactions: HasManyRepositoryFactory<DetailTransaction, typeof User.prototype.id>;

  public readonly tokens: HasManyThroughRepositoryFactory<Token, typeof Token.prototype.id,
          UserToken,
          typeof User.prototype.id
        >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('ExperienceRepository') protected experienceRepositoryGetter: Getter<ExperienceRepository>, @repository.getter('CommentRepository') protected commentRepositoryGetter: Getter<CommentRepository>, @repository.getter('SavedExperienceRepository') protected savedExperienceRepositoryGetter: Getter<SavedExperienceRepository>, @repository.getter('UserCredentialRepository') protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>, @repository.getter('PostRepository') protected postRepositoryGetter: Getter<PostRepository>, @repository.getter('LikeRepository') protected likeRepositoryGetter: Getter<LikeRepository>, @repository.getter('ConversationRepository') protected conversationRepositoryGetter: Getter<ConversationRepository>, @repository.getter('FriendRepository') protected friendRepositoryGetter: Getter<FriendRepository>, @repository.getter('UserRepository') protected userRepositoryGetter: Getter<UserRepository>, @repository.getter('DetailTransactionRepository') protected detailTransactionRepositoryGetter: Getter<DetailTransactionRepository>, @repository.getter('UserTokenRepository') protected userTokenRepositoryGetter: Getter<UserTokenRepository>, @repository.getter('TokenRepository') protected tokenRepositoryGetter: Getter<TokenRepository>,
  ) {
    super(User, dataSource);
    this.tokens = this.createHasManyThroughRepositoryFactoryFor('tokens', tokenRepositoryGetter, userTokenRepositoryGetter,);
    this.registerInclusionResolver('tokens', this.tokens.inclusionResolver);
    this.detailTransactions = this.createHasManyRepositoryFactoryFor('detailTransactions', detailTransactionRepositoryGetter,);
    this.registerInclusionResolver('detailTransactions', this.detailTransactions.inclusionResolver);
    this.friends = this.createHasManyThroughRepositoryFactoryFor('friends', Getter.fromValue(this), friendRepositoryGetter,);
    this.registerInclusionResolver('friends', this.friends.inclusionResolver);
    this.conversations = this.createHasManyRepositoryFactoryFor('conversations', conversationRepositoryGetter,);
    this.registerInclusionResolver('conversations', this.conversations.inclusionResolver);
    this.likes = this.createHasManyRepositoryFactoryFor('likes', likeRepositoryGetter,);
    this.registerInclusionResolver('likes', this.likes.inclusionResolver);
    this.posts = this.createHasManyRepositoryFactoryFor('posts', postRepositoryGetter,);
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.userCredentials = this.createHasManyRepositoryFactoryFor('userCredentials', userCredentialRepositoryGetter,);
    this.registerInclusionResolver('userCredentials', this.userCredentials.inclusionResolver);
    this.savedExperiences = this.createHasManyThroughRepositoryFactoryFor('savedExperiences', experienceRepositoryGetter, savedExperienceRepositoryGetter,);
    this.registerInclusionResolver('savedExperiences', this.savedExperiences.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
    this.experiences = this.createHasManyRepositoryFactoryFor('experiences', experienceRepositoryGetter,);
    this.registerInclusionResolver('experiences', this.experiences.inclusionResolver);
  }
}
