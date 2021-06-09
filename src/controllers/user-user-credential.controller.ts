import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody
} from '@loopback/rest';
import {
  User,
  UserCredential
} from '../models';
import {UserRepository, UserCredentialRepository} from '../repositories';

export class UserUserCredentialController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
    @repository(UserCredentialRepository) protected userCredentialRepository: UserCredentialRepository
  ) { }

  @get('/users/{id}/user-credentials', {
    responses: {
      '200': {
        description: 'Array of User has many UserCredential',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(UserCredential)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<UserCredential>,
  ): Promise<UserCredential[]> {
    return this.userRepository.userCredentials(id).find(filter);
  }

  @post('/users/{id}/user-credentials', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(UserCredential)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {
            title: 'NewUserCredentialInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) userCredential: Omit<UserCredential, 'id'>,
  ): Promise<UserCredential> {
    const foundUserCredential = await this.userCredentialRepository.findOne({
      where: {
        userId: id, 
        peopleId: userCredential.peopleId
      }
    })

    if (foundUserCredential) {
      this.userCredentialRepository.updateById(foundUserCredential.id, userCredential)
      return {
        ...userCredential,
        id: foundUserCredential.id
      }
    }
    return this.userRepository.userCredentials(id).create(userCredential);
  }

  @patch('/users/{id}/user-credentials', {
    responses: {
      '200': {
        description: 'User.UserCredential PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {partial: true}),
        },
      },
    })
    userCredential: Partial<UserCredential>,
    @param.query.object('where', getWhereSchemaFor(UserCredential)) where?: Where<UserCredential>,
  ): Promise<Count> {
    return this.userRepository.userCredentials(id).patch(userCredential, where);
  }

  @del('/users/{id}/user-credentials', {
    responses: {
      '200': {
        description: 'User.UserCredential DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(UserCredential)) where?: Where<UserCredential>,
  ): Promise<Count> {
    return this.userRepository.userCredentials(id).delete(where);
  }
}
