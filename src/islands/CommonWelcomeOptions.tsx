export default function CommonWelcomeOptions() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
			<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
				<h3 className="font-bold text-lg mb-2">Explorar el sistema</h3>
				<p className="text-gray-600 mb-3">
					Descubre todas las funcionalidades disponibles para tu rol.
				</p>
				<a href="/welcome" className="text-blue-950 hover:underline">
					Comenzar exploración →
				</a>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
				<h3 className="font-bold text-lg mb-2">Completar tu perfil</h3>
				<p className="text-gray-600 mb-3">
					Añade más información a tu perfil para mejorar tu experiencia.
				</p>
				<a href="/profile" className="text-blue-950 hover:underline">
					Editar perfil →
				</a>
			</div>
		</div>
	);
}
