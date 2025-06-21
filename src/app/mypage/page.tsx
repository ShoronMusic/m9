import Image from 'next/image';
import { UserIcon } from '@heroicons/react/24/outline';

const MyPage: React.FC = () => {
  const user = {
    photoURL: '',
    displayName: 'John Doe',
    email: 'john@example.com',
    bio: 'A passionate music lover',
  };

  const playlists = [
    { id: '1', title: 'Favorite Songs', songs: [], createdAt: new Date().toISOString() },
    { id: '2', title: 'Workout Playlist', songs: [], createdAt: new Date().toISOString() },
  ];

  const handleLogout = () => {
    // Implement logout functionality
  };

  const setShowEditProfile = (show: boolean) => {
    // Implement setShowEditProfile functionality
  };

  const handlePlayPlaylist = (playlist: any) => {
    // Implement handlePlayPlaylist functionality
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* プロフィールセクション */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt="Profile"
                width={96}
                height={96}
                className="rounded-full"
              />
            ) : (
              <UserIcon className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">{user.displayName || 'No Name'}</h2>
            <p className="text-gray-600 mb-4">{user.email}</p>
            <div className="flex space-x-4">
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Log out
              </button>
              <button
                onClick={() => setShowEditProfile(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 mb-1"><span className="font-bold">Handle Name:</span></p>
            <p className="text-lg">{user.displayName || 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1"><span className="font-bold">Bio:</span></p>
            <p className="text-lg">{user.bio || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Playlistsセクション */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <h3 className="text-xl font-semibold px-6 py-4 bg-gray-50">Playlists</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '65%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Songs</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {playlists.map((playlist) => (
                  <tr key={playlist.id}>
                    <td>{playlist.title}</td>
                    <td>{playlist.songs.length}</td>
                    <td>{new Date(playlist.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => handlePlayPlaylist(playlist)}>
                        PLAY
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPage; 