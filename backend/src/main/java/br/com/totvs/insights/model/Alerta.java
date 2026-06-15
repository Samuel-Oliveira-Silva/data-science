package br.com.totvs.insights.model;

import jakarta.persistence.*;

@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@Table(name = "TB_ALERTA")
public abstract class Alerta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TX_DESCRICAO", nullable = false)
    private String descricao;

    @ManyToOne
    @JoinColumn(name = "INSIGHT_ID", nullable = false)
    private Insight insight;

    public Alerta() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }

    public Insight getInsight() { return insight; }
    public void setInsight(Insight insight) { this.insight = insight; }

    // Método Polimórfico exigido pela rubrica da FIAP
    public abstract String processarGatilhoOperacional();
}