package br.com.totvs.insights.model;

import jakarta.persistence.*;

@Entity
@Table(name = "TB_ALERTA_UPSELL")
@PrimaryKeyJoinColumn(name = "ALERTA_ID")
public class AlertaUpsell extends Alerta {

    @Enumerated(EnumType.STRING)
    @Column(name = "ST_SITUACAO", nullable = false)
    private SituacaoOpoTipo situacao;

    public AlertaUpsell() {}

    public SituacaoOpoTipo getSituacao() { return situacao; }
    public void setSituacao(SituacaoOpoTipo situacao) { this.situacao = situacao; }

    @Override
    public String processarGatilhoOperacional() {
        if (this.situacao == SituacaoOpoTipo.IDENTIFICADA) {
            return "TRIGGER_LEAD: Gerar oportunidade no CRM e alertar Executivo de Contas.";
        }
        return "TRIGGER_LOG: Ciclo comercial de upsell atualizado para: " + this.situacao;
    }
}