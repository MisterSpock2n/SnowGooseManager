export default function DashboardPage() {
  const cards = [
    { label: 'Current Pay Period Total', value: '$0.00' },
    { label: 'Nick Hours', value: '0.0' },
    { label: 'Rhiannon Hours', value: '0.0' },
    { label: 'Rhiannon Overnights', value: '0' },
  ];

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ background: 'white', padding: 16, borderRadius: 12 }}>
            <div style={{ fontSize: 14, color: '#6b7280' }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
