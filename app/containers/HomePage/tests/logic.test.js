/**
 * Tests for HomePage logic
 */

import expect from 'expect';
import { LOCATION_CHANGE } from 'react-router-redux';

import { getReposLogic } from '../logic';

import { LOAD_REPOS,
         LOAD_REPOS_SUCCESS,
         LOAD_REPOS_ERROR } from 'containers/App/constants';
import { reposLoaded /* , repoLoadingError */ } from 'containers/App/actions';

import { createLogicMiddleware } from 'redux-logic';
import Imm from 'immutable';

describe('getReposLogic', () => {
  const username = 'jeffbski';
  const getState = () => Imm.fromJS({
    home: {
      username,
    },
  });

  it('should make request and dispatch the reposLoaded action once data returns', () => {
    const repos = [
      { id: 1, name: 'foo' },
      { id: 2, name: 'bar' },
    ];
    function requestUtil(url) { // mock requestUtil so elim network
      expect(url).toBe(`https://api.github.com/users/${username}/repos?type=all&sort=updated`);
      return new Promise((resolve) => resolve(repos));
    }
    const resultPromise = getReposLogic.process({ getState, requestUtil });
    const expectedResultAction = reposLoaded(repos, username);
    return resultPromise
      .then((action) => {
        expect(action).toEqual(expectedResultAction);
      });
  });

  it('should reject with an error if the request fails', () => {
    function requestUtil(/* url */) { // mock requestUtil so elim network
      return new Promise((resolve, reject) => reject(new Error('Not Found')));
    }
    const resultPromise = getReposLogic.process({ getState, requestUtil });
    return resultPromise
      .then(() => { throw new Error('should not be successful'); },
            (err) => {
              expect(err.message).toBe('Not Found');
            });
  });
});

/*
   The rest of these tests are optional since they are more integration
   tests, that are simply verifying that you have configured the logic
   properly for cancellation, latest
 */
describe('getReposLogic integration', () => {
  it('should dispatch reposLoaded action with results', () => {
    const repos = [
      { id: 1, name: 'foo' },
      { id: 2, name: 'bar' },
    ];
    function requestUtil(/* url */) { // mock requestUtil so elim network
      return new Promise((resolve) => resolve(repos));
    }
    const mw = createLogicMiddleware([getReposLogic], { requestUtil });
    const username = 'jeffbski';
    const getState = () => Imm.fromJS({
      home: {
        username,
      },
    });
    const next = expect.createSpy();
    const dispatch = expect.createSpy();
    const loadReposAction = { type: LOAD_REPOS };
    mw({ dispatch, getState })(next)(loadReposAction);
    return mw.whenComplete(() => {
      expect(next.calls.length).toBe(1);
      expect(next.calls[0].arguments[0]).toEqual(loadReposAction);
      expect(dispatch.calls.length).toBe(1);
      expect(dispatch.calls[0].arguments[0].type).toBe(LOAD_REPOS_SUCCESS);
      expect(dispatch.calls[0].arguments[0].repos).toEqual(repos);
      expect(dispatch.calls[0].arguments[0].username).toBe(username);
    });
  });

  it('should dispatch repoLoadingError action if the response errors', () => {
    function requestUtil(/* url */) { // mock requestUtil so elim network
      return new Promise((resolve, reject) => reject(new Error('Not Found')));
    }
    const mw = createLogicMiddleware([getReposLogic], { requestUtil });
    const username = 'foobar';
    const getState = () => Imm.fromJS({
      home: {
        username,
      },
    });
    const next = expect.createSpy();
    const dispatch = expect.createSpy();
    const loadReposAction = { type: LOAD_REPOS };
    mw({ dispatch, getState })(next)(loadReposAction);
    return mw.whenComplete(() => {
      expect(next.calls.length).toBe(1);
      expect(next.calls[0].arguments[0]).toEqual(loadReposAction);
      expect(dispatch.calls.length).toBe(1);
      expect(dispatch.calls[0].arguments[0].type).toBe(LOAD_REPOS_ERROR);
      expect(dispatch.calls[0].arguments[0].error.message).toBe('Not Found');
    });
  });

  it('should cancel the inflight request on LOCATION_CHANGE', () => {
    function requestUtil(/* url */) { // mock requestUtil so elim network
      return new Promise((resolve) => {
        setTimeout(() => { // delay response so we can cancel
          resolve([]);
        }, 30);
      });
    }
    const mw = createLogicMiddleware([getReposLogic], { requestUtil });
    const username = 'jeffbski';
    const getState = () => Imm.fromJS({
      home: {
        username,
      },
    });
    const next = expect.createSpy();
    const dispatch = expect.createSpy();
    const loadReposAction = { type: LOAD_REPOS };
    const mwInstance = mw({ dispatch, getState })(next);
    mwInstance(loadReposAction); // trigger request
    mwInstance({ type: LOCATION_CHANGE }); // route changed before resp
    return mw.whenComplete(() => {
      expect(next.calls.length).toBe(2); // loadReposAction, LOCATION_CHANGE
      expect(dispatch.calls.length).toBe(0);
    });
  });

  it('should only dispatch latest when multiple requests made', () => {
    function requestUtil(url) { // mock requestUtil so elim network
      return new Promise((resolve) => {
        setTimeout(() => { // delay response so we can cancel first
          resolve([url]); // send back url so we can confirm
        }, 30);
      });
    }
    const mw = createLogicMiddleware([getReposLogic], { requestUtil });
    const username1 = 'codewinds';
    let state = Imm.fromJS({
      home: {
        username: username1,
      },
    });
    const getState = () => state;
    const next = expect.createSpy();
    const dispatch = expect.createSpy();
    const loadReposAction = { type: LOAD_REPOS };
    const mwInstance = mw({ dispatch, getState })(next);
    mwInstance(loadReposAction); // trigger codewinds request

    // now we will change the state
    const username2 = 'jeffbski';
    state = state.setIn(['home', 'username'], username2);
    mwInstance(loadReposAction); // trigger jeffbski request
    return mw.whenComplete(() => {
      expect(next.calls.length).toBe(2); // loadReposAction, loadReposAction
      expect(dispatch.calls.length).toBe(1); // only latest response
      expect(dispatch.calls[0].arguments[0].type).toBe(LOAD_REPOS_SUCCESS);
      expect(dispatch.calls[0].arguments[0].username).toBe(username2);
      expect(dispatch.calls[0].arguments[0].repos).toEqual([
        `https://api.github.com/users/${username2}/repos?type=all&sort=updated`,
      ]);
    });
  });
});
