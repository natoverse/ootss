export function createMessageClient(db, auth, sdk) {
  const pageSize = 50;
  function message(snapshot) {
    const data = snapshot.data({ serverTimestamps: 'estimate' });
    if (typeof data.text !== 'string' || typeof data.authorName !== 'string'
      || typeof data.authorUid !== 'string' || typeof data.boardId !== 'string'
      || typeof data.createdAt?.toMillis !== 'function') {
      throw new Error('A saved message has an invalid format.');
    }
    return {
      id: snapshot.ref.path,
      boardId: data.boardId,
      text: data.text,
      authorName: data.authorName,
      authorUid: data.authorUid,
      createdAt: data.createdAt.toMillis(),
      pending: snapshot.metadata.hasPendingWrites,
    };
  }

  function messagesQuery(boardId, cursor) {
    const source = boardId === 'all'
      ? sdk.collectionGroup(db, 'boardMessages')
      : sdk.collection(db, 'boards', boardId, 'boardMessages');
    const constraints = boardId === 'all' ? [sdk.where('kind', '==', 'cell')] : [];
    constraints.push(sdk.orderBy('createdAt', 'desc'));
    if (cursor) constraints.push(sdk.startAfter(cursor));
    constraints.push(sdk.limit(pageSize));
    return sdk.query(source, ...constraints);
  }

  function page(snapshot) {
    return {
      messages: snapshot.docs.map(message),
      cursor: snapshot.docs.at(-1) || null,
      hasMore: snapshot.docs.length === pageSize,
      fromCache: snapshot.metadata.fromCache,
    };
  }

  return {
    listen(boardId, onUpdate, onError) {
      return sdk.onSnapshot(messagesQuery(boardId), { includeMetadataChanges: true }, snapshot => {
        try { onUpdate(page(snapshot)); }
        catch (error) { onError(error); }
      }, onError);
    },
    async older(boardId, cursor) {
      return page(await sdk.getDocsFromServer(messagesQuery(boardId, cursor)));
    },
    listenCells(prefix, onUpdate, onError) {
      const source = sdk.collection(db, 'boards');
      const query = sdk.query(source, sdk.where('mapPrefix', '==', prefix), sdk.limit(30000));
      return sdk.onSnapshot(query, snapshot => {
        try { onUpdate(snapshot.docs.map(document => document.id)); }
        catch (error) { onError(error); }
      }, onError);
    },
    async send(boardId, text) {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in with Google to post a message.');
      const body = text.trim();
      if (!body || body.length > 4000) throw new Error('Messages must contain 1 to 4,000 characters.');
      if (!user.displayName?.trim() || user.displayName.length > 100) {
        throw new Error('Your Google profile needs a display name of 1 to 100 characters.');
      }
      const reference = sdk.doc(sdk.collection(db, 'boards', boardId, 'boardMessages'));
      const batch = sdk.writeBatch(db);
      batch.set(reference, {
        boardId,
        kind: boardId === 'general' ? 'general' : 'cell',
        authorUid: user.uid,
        authorName: user.displayName,
        text: body,
        createdAt: sdk.serverTimestamp(),
      });
      batch.set(sdk.doc(db, 'boards', boardId), {
        kind: boardId === 'general' ? 'general' : 'cell',
        mapPrefix: boardId === 'general' ? '' : boardId.match(/^[A-Z]+/)[0],
        lastMessageId: reference.id,
        updatedAt: sdk.serverTimestamp(),
      });
      await batch.commit();
    },
    flush: () => sdk.waitForPendingWrites(db),
  };
}
